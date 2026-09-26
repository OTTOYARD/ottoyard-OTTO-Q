import { useQuery } from "@tanstack/react-query";
import { ottoQFetch, ottoqInvoke } from "@/lib/otto-q-api";
import { useIncidentsStore } from "@/stores/incidentsStore";
import { useDepotCards, useFleetCondition } from "@/lib/twin/hooks";

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

export interface IncidentMetrics {
  totalIncidents: number;
  activeIncidents: number;
  pendingIncidents: number;
  closedIncidents: number;
  incidentsByType: Record<string, number>;
}

export interface FleetContext {
  vehicles: VehicleSummary[];
  depots: DepotSummary[];
  jobs: JobSummary[];
  fleetMetrics: FleetMetrics;
  depotMetrics: DepotMetrics;
  incidentMetrics: IncidentMetrics;
  cities: { id: string; name: string; tz: string }[];
  timestamp: string;
  isLoading: boolean;
  error: string | null;
}

export function useFleetContext(): FleetContext {
  const incidents = useIncidentsStore((state) => state.incidents);

  // Vehicles from the shared twin layer: the depot card feed (the same per-vehicle contract every cockpit panel
  // reads) and, for battery health, the live run's fleet condition. This used to call a hook with the literal run
  // id "current_sim_run_id" and the wrong argument names, so the assistant was handed no vehicles at all.
  const cards = useDepotCards(null);
  const condition = useFleetCondition(cards.data?.sim_run_id ?? null);
  const vehiclesLoading = cards.isLoading;
  const vehiclesError = cards.error ? String((cards.error as Error).message) : null;

  // Fetch depot aggregates from the shared brain fleet summary
  const { data: depotsData, isLoading: depotsLoading, error: depotsError } = useQuery({
    queryKey: ["fleetContext", "depots"],
    queryFn: async () => {
      const summary = await ottoQFetch<{ depots?: any[] }>("/fleet/summary");
      const depots = summary?.depots ?? [];

      // /fleet/summary gives per-depot stall + job aggregates already. The legacy
      // shape distinguished charge / detail / maintenance stalls, which the summary
      // does not break out — map total/available stalls onto charge stalls (the
      // primary capacity) and leave detail/maintenance at 0 (no breakdown available).
      return depots.map((d: any): DepotSummary => ({
        id: d.id,
        name: d.name,
        cityId: d.city || "",
        cityName: d.city || "Unknown",
        totalChargeStalls: d.stalls_total ?? 0,
        availableChargeStalls: d.stalls_available ?? Math.max(0, (d.stalls_total ?? 0) - (d.stalls_occupied ?? 0)),
        totalDetailStalls: 0,
        availableDetailStalls: 0,
        totalMaintenanceBays: 0,
        availableMaintenanceBays: 0,
        activeJobs: d.in_service ?? 0,
        pendingJobs: 0,
      }));
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch active jobs from the shared brain
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ["fleetContext", "jobs"],
    queryFn: async () => {
      const resp = await ottoqInvoke<{ jobs?: any[] }>("ottoq-jobs-active", { limit: 100 });
      return (resp?.jobs ?? []).map((job: any): JobSummary => ({
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

  // Calculate incident metrics
  const incidentMetrics: IncidentMetrics = {
    totalIncidents: incidents.length,
    activeIncidents: incidents.filter((i) => i.status === "Dispatched" || i.status === "Secured").length,
    pendingIncidents: incidents.filter((i) => i.status === "Reported").length,
    closedIncidents: incidents.filter((i) => i.status === "Closed").length,
    incidentsByType: incidents.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
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

  // Calculate depot metrics
  const depots = depotsData || [];
  const jobs = jobsData || [];
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

  const isLoading = vehiclesLoading || depotsLoading || jobsLoading;
  const anyError = (vehiclesError || depotsError || jobsError) as unknown;
  const error =
    anyError == null
      ? null
      : typeof anyError === "string"
      ? anyError
      : (anyError as Error).message ?? "Unknown error";

  return {
    vehicles,
    depots,
    jobs,
    fleetMetrics,
    depotMetrics,
    incidentMetrics,
    cities: [],
    timestamp: new Date().toISOString(),
    isLoading,
    error,
  };
}

// Helper function to serialize fleet context for AI
export function serializeFleetContext(context: FleetContext): string {
  const { fleetMetrics, depotMetrics, incidentMetrics, vehicles, depots, cities, timestamp } = context;

  return `
=== REAL-TIME FLEET DATA (as of ${new Date(timestamp).toLocaleString()}) ===

FLEET SUMMARY:
• Total Vehicles: ${fleetMetrics.totalVehicles}
• Active/In Service: ${fleetMetrics.activeVehicles}
• At Depot/Charging: ${fleetMetrics.chargingVehicles}
• Idle: ${fleetMetrics.idleVehicles}
• En Route to Depot: ${fleetMetrics.enRouteVehicles}
• In Maintenance: ${fleetMetrics.maintenanceVehicles}
• Average SOC: ${fleetMetrics.avgSoc}%
• Low Battery (<30%): ${fleetMetrics.lowBatteryCount} vehicles
• Critical Battery (<15%): ${fleetMetrics.criticalBatteryCount} vehicles
• Average Battery Health: ${fleetMetrics.avgHealthScore === null ? "not drawn for this run" : `${fleetMetrics.avgHealthScore}%`}

DEPOT OPERATIONS:
• Total Depots: ${depotMetrics.totalDepots}
• Charge Stalls: ${depotMetrics.availableChargeStalls}/${depotMetrics.totalChargeStalls} available (${100 - depotMetrics.chargeStallUtilization}% free)
• Detail Stalls: ${depotMetrics.availableDetailStalls}/${depotMetrics.totalDetailStalls} available
• Maintenance Bays: ${depotMetrics.availableMaintenanceBays}/${depotMetrics.totalMaintenanceBays} available
• Active Jobs: ${depotMetrics.activeJobs}
• Pending/Scheduled Jobs: ${depotMetrics.pendingJobs}

INCIDENT STATUS:
• Total Incidents: ${incidentMetrics.totalIncidents}
• Active: ${incidentMetrics.activeIncidents}
• Pending: ${incidentMetrics.pendingIncidents}
• Closed: ${incidentMetrics.closedIncidents}
${Object.entries(incidentMetrics.incidentsByType).map(([type, count]) => `• ${type}: ${count}`).join('\n')}

CITIES: ${cities.map(c => c.name).join(', ')}

DEPOT DETAILS:
${depots.slice(0, 10).map(d => `• ${d.name} (${d.cityName}): ${d.availableChargeStalls}/${d.totalChargeStalls} charge stalls, ${d.activeJobs} active jobs`).join('\n')}

VEHICLE SAMPLES (top 20 by status):
${vehicles.slice(0, 20).map(v => `• ${v.oem} ${v.plate || v.id.slice(0, 8)} | SOC: ${Math.round(v.soc * 100)}% | Status: ${v.status} | City: ${v.cityName} | Battery health: ${v.healthScore === null ? "n/a" : `${v.healthScore}%`}`).join('\n')}
`.trim();
}
