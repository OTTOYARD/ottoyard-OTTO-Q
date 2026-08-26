import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ottoQFetch,
  ottoqInvoke,
  FleetSummary,
  AIFleetSummary,
  EnergyHistory,
  ScheduleIntelligence,
} from "@/lib/otto-q-api";

export function useScheduleIntelligence(horizon: "12h" | "24h" | "48h" = "24h") {
  return useQuery<ScheduleIntelligence>({
    queryKey: ["otto-q", "schedule-intelligence", horizon],
    queryFn: () =>
      ottoQFetch<ScheduleIntelligence>(
        `/fleet/schedule-intelligence?horizon=${horizon}`
      ),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

export function useFleetSummary() {
  return useQuery<FleetSummary>({
    queryKey: ["otto-q", "fleet-summary"],
    queryFn: () => ottoQFetch<FleetSummary>("/fleet/summary"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useAIFleetSummary() {
  return useQuery<AIFleetSummary>({
    queryKey: ["otto-q", "ai-fleet-summary"],
    queryFn: () => ottoQFetch<AIFleetSummary>("/ai/fleet-summary"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useEnergyHistory(
  range: "24h" | "7d" | "30d" | "90d",
  depotId?: string
) {
  const qs = new URLSearchParams({ range });
  if (depotId) qs.set("depot_id", depotId);
  return useQuery<EnergyHistory>({
    queryKey: ["otto-q", "energy-history", range, depotId || "all"],
    queryFn: () => ottoQFetch<EnergyHistory>(`/energy/history?${qs}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface OrchestrateTickResult {
  depot?: string;
  energy?: { tariff?: string; max_concurrent_dcfc?: number; billing_peak_kw?: number };
  summary?: {
    vehicles_planned?: number;
    charge_assigned?: number;
    charge_source?: string;
    tasks_awaiting_resource?: number;
  };
}

// Triggers OTTO-Q's depot-wide re-optimizer: the deterministic decide path disposes, with
// gated proposers (cuOpt et al.) upstream, under the energy cap and the 52-rule shield.
// The response's charge_source says which engine actually produced each assignment.
// Defaults to the primary depot if no depotId is given.
export function useReoptimizeDepot(depotId?: string) {
  const qc = useQueryClient();
  return useMutation<OrchestrateTickResult, Error, void>({
    mutationFn: () =>
      ottoqInvoke<OrchestrateTickResult>("ottoq-orchestrate-tick", {
        depot_id: depotId,
        submit: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["otto-q", "schedule-intelligence"] });
      qc.invalidateQueries({ queryKey: ["otto-q", "fleet-summary"] });
    },
  });
}
