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
};
