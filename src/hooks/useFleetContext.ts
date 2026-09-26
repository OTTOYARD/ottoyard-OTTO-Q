import { useQuery } from "@tanstack/react-query";
import { ottoqInvoke } from "@/lib/otto-q-api";
import { useDepotCards, useFleetCondition, useLayout, useRunEventFeed, useSnapshot } from "@/lib/twin/hooks";
import { stallOccupancy, sumTypes, type StallTypeCount } from "@/lib/twin/occupancy";
import { describeEvent } from "@/lib/twin/eventFeed";
import { incidentGroups } from "@/lib/twin/incidents";

// Map an otto-q-core vehicle_state to the legacy uppercase status vocab that the
// fleet metric computations below already key off (IN_SERVICE / AT_DEPOT / IDLE /
// MAINTENANCE / ENROUTE_DEPOT).
function mapStateToLegacyStatus(state: string): string {
  const s = (state || "").toLowerCase();
  if (s.startsWith("charging")) return "AT_DEPOT";
  if (s.includes("wash_bay") || s.includes("detail_bay") || s.includes("service_bay")) return "MAINTENANCE";
  if (s.includes("en_route")) return "ENROUTE_DEPOT";
  if (s === "deployed" || s === "departed") return "IN_SERVICE";
  if (
    s === "staged_awaiting_service" ||
    s === "arrived_at_gate" ||
    s === "awaiting_departure"
  )
    return "AT_DEPOT";
  return "IDLE";
}

export interface VehicleSummary {
  id: string;
  oem: string;
  plate: string | null;
  soc: number;
  status: string;
  cityId: string;
  cityName: string;
  /** Battery state of health, %, as drawn for the live run (ottoq_twin_fleet_condition). null when not drawn. */
  healthScore: number | null;
  lastTelemetryAt: string | null;
}

export interface DepotSummary {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  totalChargeStalls: number;
  availableChargeStalls: number;
  totalDetailStalls: number;
  availableDetailStalls: number;
  totalMaintenanceBays: number;
  availableMaintenanceBays: number;
  activeJobs: number;
  pendingJobs: number;
}

export interface JobSummary {
  id: string;
  vehicleId: string;
  depotId: string;
  depotName: string;
  jobType: string;
  state: string;
  scheduledStartAt: string | null;
  etaSeconds: number | null;
}

export interface FleetMetrics {
  totalVehicles: number;
  activeVehicles: number;
  chargingVehicles: number;
  idleVehicles: number;
  maintenanceVehicles: number;
  enRouteVehicles: number;
  avgSoc: number;
  lowBatteryCount: number;
  criticalBatteryCount: number;
  /** Mean battery state of health over the vehicles that have one; null when none do. */
  avgHealthScore: number | null;
}

export interface DepotMetrics {
  totalDepots: number;
  totalChargeStalls: number;
  availableChargeStalls: number;
  chargeStallUtilization: number;
  totalDetailStalls: number;
  availableDetailStalls: number;
  totalMaintenanceBays: number;
  availableMaintenanceBays: number;
  activeJobs: number;
  pendingJobs: number;
  completedJobsToday: number;
}

/** From the live run's event feed (warning or worse), split the way the Incidents view splits it. */
export interface IncidentMetrics {
  totalIncidents: number;
  /** things that went wrong on one vehicle, charger or the engine */
  activeIncidents: number;
  /** depot-wide conditions the engine re-reports every tick while they hold */
  pendingIncidents: number;
  closedIncidents: number;
  incidentsByType: Record<string, number>;
}

export interface FleetContext {
  /** The live run on the twin depot, or null. With no run every figure below is empty, and the serializer says so. */
  runId: string | null;
  simClock: string | null;
  vehicles: VehicleSummary[];
  /** The twin depot only (OTTOYARD Nashville Flagship, the one site simulated), while a run is live. The
   *  "available" fields count stalls OPEN by the pointer: no car on it and no live hold. That is not availability,
   *  which also depends on the stall's calendar and, for a charger, a working charger. OTTO-Q decides that. */
  depots: DepotSummary[];
  /** The same depot's stall pointers by stall type (lib/twin/occupancy). */
  occupancy: Record<string, StallTypeCount>;
  jobs: JobSummary[];
  fleetMetrics: FleetMetrics;
  depotMetrics: DepotMetrics;
  incidentMetrics: IncidentMetrics;
  cities: { id: string; name: string; tz: string }[];
  timestamp: string;
  isLoading: boolean;
  error: string | null;
}

const CHARGER_TYPES = ["dcfc", "l2"];

/** One row of the `ottoq-jobs-active` edge function's reply, as this hook reads it. */
interface ActiveJobRow {
  id: string;
  vehicle_id: string;
  stall_id?: string | null;
  stall_code?: string | null;
  service?: string | null;
  status?: string | null;
  scheduled_start?: string | null;
}

/**
 * What the fleet assistant is told about the depot. With `fleetOperatorId`, the owner's projection: their vehicles
 * and the incidents that name one of them. Stall occupancy and depot-wide conditions stay depot-wide, because the
 * owner's cars share that depot.
 */
export function useFleetContext(fleetOperatorId: string | null = null): FleetContext {
  // Vehicles from the shared twin layer: the depot card feed (the same per-vehicle contract every cockpit panel
  // reads) and, for battery health, the live run's fleet condition.
  const cards = useDepotCards(fleetOperatorId);
  const runId = cards.data?.sim_run_id ?? null;
  const condition = useFleetCondition(runId);
  const vehiclesLoading = cards.isLoading;
  const vehiclesError = cards.error ? String((cards.error as Error).message) : null;

  // The depot, its stalls and its incidents, from the live run. This used to read /fleet/summary, a census of every
  // depot's stall pointers with every stall type counted as a charger, and a seeded incident store that was empty.
  const snapshot = useSnapshot(runId);
  const layout = useLayout();
  const feed = useRunEventFeed(runId);

  // Fetch active jobs from the shared brain
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ["fleetContext", "jobs"],
    queryFn: async () => {
      const resp = await ottoqInvoke<{ jobs?: ActiveJobRow[] }>("ottoq-jobs-active", { limit: 100 });
      return (resp?.jobs ?? []).map((job): JobSummary => ({
        id: job.id,
        vehicleId: job.vehicle_id,
        depotId: job.stall_id ?? "",
        depotName: job.stall_code || "Depot",
        jobType: job.service || "",
        state: String(job.status || "").toUpperCase(),
        scheduledStartAt: job.scheduled_start ?? null,
        etaSeconds: null,
      }));
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Transform vehicles
  const soh = new Map((condition.data?.vehicles ?? []).map((c) => [c.vehicle_id, c.battery_soh_pct] as const));
  const vehicles: VehicleSummary[] = (cards.data?.vehicles ?? []).map((v) => {
    const h = soh.get(v.vehicle_id);
    return {
      id: v.vehicle_id,
      oem: v.oem ?? "",
      plate: v.display_name,
      soc: (v.soc ?? 0) / 100, // otto-q-core soc is 0-100; context uses 0-1
      status: mapStateToLegacyStatus(v.state),
      cityId: "nashville",
      cityName: "Nashville", // the twin depot (OTTOYARD Nashville Flagship) is the only site simulated
      healthScore: typeof h === "number" && Number.isFinite(h) ? Math.round(h) : null,
      lastTelemetryAt: null,
    };
  });
  const withHealth = vehicles.filter((v) => v.healthScore !== null);

  // Incidents on this run: warning or worse, split as the Incidents view splits them
  const ownNames = fleetOperatorId ? new Set((cards.data?.vehicles ?? []).map((v) => v.display_name)) : null;
  const groups = incidentGroups(runId ? feed.data : [], ownNames);
  const incidentsByType: Record<string, number> = {};
  for (const r of [...groups.attention, ...groups.standing]) {
    const title = describeEvent(r.event_type, r.payload).title;
    incidentsByType[title] = (incidentsByType[title] ?? 0) + 1;
  }
  const incidentMetrics: IncidentMetrics = {
    totalIncidents: groups.attention.length + groups.standing.length,
    activeIncidents: groups.attention.length,
    pendingIncidents: groups.standing.length,
    closedIncidents: 0,
    incidentsByType,
  };

  // Calculate fleet metrics from twin vehicles
  const fleetMetrics: FleetMetrics = {
    totalVehicles: vehicles.length,
    activeVehicles: vehicles.filter((v) => v.status === "IN_SERVICE" || v.status === "ON_TRIP").length,
    chargingVehicles: vehicles.filter((v) => v.status === "AT_DEPOT").length,
    idleVehicles: vehicles.filter((v) => v.status === "IDLE").length,
    maintenanceVehicles: vehicles.filter((v) => v.status === "MAINTENANCE").length,
    enRouteVehicles: vehicles.filter((v) => v.status === "ENROUTE_DEPOT").length,
    avgSoc: vehicles.length > 0 ? Math.round((vehicles.reduce((sum, v) => sum + v.soc, 0) / vehicles.length) * 100) : 0,
    lowBatteryCount: vehicles.filter((v) => v.soc < 0.3).length,
    criticalBatteryCount: vehicles.filter((v) => v.soc < 0.15).length,
    avgHealthScore: withHealth.length > 0 ? Math.round(withHealth.reduce((sum, v) => sum + (v.healthScore ?? 0), 0) / withHealth.length) : null,
  };

  // The twin depot's stalls by type, while a run is live
  const occupancy = runId ? stallOccupancy(layout.data, snapshot.data) : {};
  const chargers = sumTypes(occupancy, CHARGER_TYPES);
  const wash = sumTypes(occupancy, ["wash_bay"]);
  const service = sumTypes(occupancy, ["service_bay"]);
  const jobs = jobsData || [];
  const depot = layout.data?.depot;
  const depots: DepotSummary[] =
    runId && depot
      ? [{
          id: depot.id,
          name: depot.name,
          cityId: "nashville",
          cityName: "Nashville",
          totalChargeStalls: chargers.total,
          availableChargeStalls: chargers.open,
          totalDetailStalls: wash.total,
          availableDetailStalls: wash.open,
          totalMaintenanceBays: service.total,
          availableMaintenanceBays: service.open,
          activeJobs: jobs.filter((j) => j.state === "ACTIVE").length,
          pendingJobs: jobs.filter((j) => ["PENDING", "SCHEDULED"].includes(j.state)).length,
        }]
      : [];
  const depotMetrics: DepotMetrics = {
    totalDepots: depots.length,
    totalChargeStalls: depots.reduce((sum, d) => sum + d.totalChargeStalls, 0),
    availableChargeStalls: depots.reduce((sum, d) => sum + d.availableChargeStalls, 0),
    chargeStallUtilization: depots.reduce((sum, d) => sum + d.totalChargeStalls, 0) > 0
      ? Math.round(((depots.reduce((sum, d) => sum + d.totalChargeStalls, 0) - depots.reduce((sum, d) => sum + d.availableChargeStalls, 0)) / depots.reduce((sum, d) => sum + d.totalChargeStalls, 0)) * 100)
      : 0,
    totalDetailStalls: depots.reduce((sum, d) => sum + d.totalDetailStalls, 0),
    availableDetailStalls: depots.reduce((sum, d) => sum + d.availableDetailStalls, 0),
    totalMaintenanceBays: depots.reduce((sum, d) => sum + d.totalMaintenanceBays, 0),
    availableMaintenanceBays: depots.reduce((sum, d) => sum + d.availableMaintenanceBays, 0),
    activeJobs: jobs.filter((j) => j.state === "ACTIVE").length,
    pendingJobs: jobs.filter((j) => ["PENDING", "SCHEDULED"].includes(j.state)).length,
    completedJobsToday: 0, // Would need additional query
  };

  const isLoading = vehiclesLoading || jobsLoading;
  const anyError = (vehiclesError || jobsError) as unknown;
  const error =
    anyError == null
      ? null
      : typeof anyError === "string"
      ? anyError
      : (anyError as Error).message ?? "Unknown error";

  return {
    runId,
    simClock: cards.data?.sim_clock ?? null,
    vehicles,
    depots,
    occupancy,
    jobs,
    fleetMetrics,
    depotMetrics,
    incidentMetrics,
    cities: runId ? [{ id: "nashville", name: "Nashville", tz: "America/Chicago" }] : [],
    timestamp: new Date().toISOString(),
    isLoading,
    error,
  };
}
