// ============================================================================
// The ONE read client both cockpits use to see the twin.
//
// It reads exactly the feeds the twin cockpit reads (ottoyarddepot-sim
// src/lib/ottoTwin.ts): the otto-twin-control snapshot + layout, and the
// twin's public RPCs. No cockpit keeps its own copy of depot state.
// Reads only. Nothing here can change the world.
// ============================================================================
import { OTTOQ_ANON_KEY, OTTOQ_URL } from "./config";
import type { TwinEventsWindow, TwinFleetCondition, TwinLayout, TwinSnapshot, TwinWearWindow } from "./types";
import type { ActivityRow, AppointmentsResponse, DepotCardsResponse } from "./cards";
import type { DialPromotion, KpiFive, SitePowerPlan } from "./plan";
import type { RunEventRow } from "./eventFeed";

const TWIN = `${OTTOQ_URL}/functions/v1/otto-twin-control`;
const HEADERS = {
  apikey: OTTOQ_ANON_KEY,
  Authorization: `Bearer ${OTTOQ_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function twinGet<T>(path: string): Promise<T> {
  // No auth headers on the edge-function GETs, exactly like the twin cockpit: otto-twin-control's
  // CORS preflight does not allow `apikey`, so sending it makes every browser read fail.
  const r = await fetch(`${TWIN}${path}`);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error(`twin ${path}: ${r.status} ${j?.error ?? ""}`.trim());
  return (j.data ?? j) as T;
}

export async function ottoqRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${OTTOQ_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

/** A read of a table the anon key is granted SELECT on (PostgREST query string, no leading slash). */
async function ottoqRead<T>(query: string): Promise<T> {
  const r = await fetch(`${OTTOQ_URL}/rest/v1/${query}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`read ${query.split("?")[0]}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export const twinApi = {
  snapshot: (simRunId: string) => twinGet<TwinSnapshot>(`/sim_runs/${simRunId}/snapshot`),
  layout: (depotId: string) => twinGet<TwinLayout>(`/depot/${depotId}/layout`),
  depotCards: (depotId: string, fleetOperatorId: string | null) =>
    ottoqRpc<DepotCardsResponse>("ottoq_depot_cards", {
      p_depot_id: depotId,
      ...(fleetOperatorId ? { p_fleet_operator_id: fleetOperatorId } : {}),
    }),
  activityFeed: (simRunId: string, opts: { limit?: number; vehicleId?: string | null; changesOnly?: boolean } = {}) =>
    ottoqRpc<ActivityRow[]>("ottoq_activity_feed", {
      p_sim_run_id: simRunId,
      p_limit: opts.limit ?? 60,
      p_vehicle_id: opts.vehicleId ?? null,
      p_changes_only: opts.changesOnly ?? true,
    }),
  fleetCondition: (simRunId: string) => ottoqRpc<TwinFleetCondition>("ottoq_twin_fleet_condition", { p_sim_run_id: simRunId }),
  eventsWindow: (simRunId: string) => ottoqRpc<TwinEventsWindow>("ottoq_twin_events_window", { p_sim_run_id: simRunId }),
  wearWindow: (simRunId: string) => ottoqRpc<TwinWearWindow>("ottoq_twin_wear_window", { p_sim_run_id: simRunId }),
  appointments: (simRunId: string) => ottoqRpc<AppointmentsResponse>("ottoq_twin_appointments", { p_sim_run_id: simRunId }),
  /** ottoq_kpi_five for one run, through the control door exactly as the twin cockpit's KPI tab reads it. */
  kpis: (simRunId: string) => twinGet<KpiFive>(`/sim_runs/${simRunId}/kpis`),
  /** The run's site power plan (ServiceProfile, 0442): the forward schedule in force now. */
  sitePowerPlan: async (simRunId: string) =>
    (
      await ottoqRead<SitePowerPlan[]>(
        `service_profiles?sim_run_id=eq.${simRunId}&resource_kind=eq.site_power` +
          "&select=sim_run_id,published_at,window_start,window_end,profile_state,periods&order=published_at.desc&limit=1",
      )
    )[0] ?? null,
  /** The run's events in sim time (otto-q-core 0462): no row-diff audit trail, no rule evaluations, a per-tick
   *  summary collapsed into one standing row. The twin cockpit's Events tab reads the same function. */
  eventFeed: (simRunId: string, limit = 200, windowMin = 600) =>
    ottoqRpc<RunEventRow[]>("ottoq_run_event_feed", { p_sim_run_id: simRunId, p_limit: limit, p_window_min: windowMin }),
  /** The learning loop's ledger for the depot, newest first. */
  dialPromotions: (depotId: string, limit = 20) =>
    ottoqRead<DialPromotion[]>(
      `ottoq_dial_promotion_ledger?depot_id=eq.${depotId}` +
        "&select=promotion_id,decided_at,param_key,from_value,to_value,outcome,reason,scenario,cell_runs,cell_seeds,rolled_back_of,experiment_id" +
        `&order=promotion_id.desc&limit=${limit}`,
    ),
};
