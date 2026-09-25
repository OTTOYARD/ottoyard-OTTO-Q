// ============================================================================
// React hooks over the twin read client. ONE run selector for every panel:
// the depot card feed names the live run (running | paused on the flagship
// depot), and every other feed keys off that id. When it is null, every panel
// says "No live run". Nothing falls back to old or invented data.
// ============================================================================
import { useQuery } from "@tanstack/react-query";
import { twinApi } from "./client";
import { FLAGSHIP_DEPOT_ID, LIVE_POLL_MS } from "./config";

export function useDepotCards(fleetOperatorId: string | null = null, depotId: string = FLAGSHIP_DEPOT_ID) {
  return useQuery({
    queryKey: ["twin", "depot-cards", depotId, fleetOperatorId],
    queryFn: () => twinApi.depotCards(depotId, fleetOperatorId),
    refetchInterval: LIVE_POLL_MS,
    staleTime: LIVE_POLL_MS / 2,
  });
}

export function useSnapshot(simRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["twin", "snapshot", simRunId],
    queryFn: () => twinApi.snapshot(simRunId as string),
    enabled: !!simRunId,
    refetchInterval: LIVE_POLL_MS,
    staleTime: LIVE_POLL_MS / 2,
  });
}

export function useLayout(depotId: string = FLAGSHIP_DEPOT_ID) {
  return useQuery({
    queryKey: ["twin", "layout", depotId],
    queryFn: () => twinApi.layout(depotId),
    staleTime: Infinity,
  });
}

export function useActivityFeed(
  simRunId: string | null | undefined,
  opts: { limit?: number; vehicleId?: string | null; changesOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: ["twin", "activity", simRunId, opts.limit ?? 60, opts.vehicleId ?? null, opts.changesOnly ?? true],
    queryFn: () => twinApi.activityFeed(simRunId as string, opts),
    enabled: !!simRunId,
    refetchInterval: LIVE_POLL_MS,
  });
}

/** Dealt once at run boot and constant after (lifespan = run). Fetched once per run. */
export function useFleetCondition(simRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["twin", "fleet-condition", simRunId],
    queryFn: () => twinApi.fleetCondition(simRunId as string),
    enabled: !!simRunId,
    staleTime: Infinity,
  });
}

export function useEventsWindow(simRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["twin", "events-window", simRunId],
    queryFn: () => twinApi.eventsWindow(simRunId as string),
    enabled: !!simRunId,
    refetchInterval: LIVE_POLL_MS * 3,
  });
}

export function useWearWindow(simRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["twin", "wear-window", simRunId],
    queryFn: () => twinApi.wearWindow(simRunId as string),
    enabled: !!simRunId,
    refetchInterval: LIVE_POLL_MS * 6,
  });
}

export function useAppointments(simRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["twin", "appointments", simRunId],
    queryFn: () => twinApi.appointments(simRunId as string),
    enabled: !!simRunId,
    refetchInterval: LIVE_POLL_MS,
  });
}

/**
 * The whole live picture for one cockpit projection. PULSE passes null (every
 * owner); OrchestrAV passes the signed-in owner's operator id.
 */
export function useLiveDepot(fleetOperatorId: string | null = null) {
  const cards = useDepotCards(fleetOperatorId);
  const runId = cards.data?.sim_run_id ?? null;
  const snapshot = useSnapshot(runId);
  const condition = useFleetCondition(runId);
  const layout = useLayout();
  return { cards, snapshot, condition, layout, runId, runStatus: cards.data?.run_status ?? null, simClock: cards.data?.sim_clock ?? null };
}
