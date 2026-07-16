import { useQuery } from "@tanstack/react-query";
import { ottoqRpc } from "@/lib/otto-q-api";

// Per-vehicle "OTTO-Q Sequence" cards from the otto-q-core brain.
// ONE depot-wide PostgREST RPC (ottoq_depot_cards) feeds every visible vehicle
// card — components share the same queryKey so the request is deduped; never
// make per-card requests.

const DEPOT_ID = "11111111-1111-1111-1111-111111111111"; // flagship depot

// --- Contract types (ottoq_depot_cards, contract_version 1.0) ---

export interface OttoQCardStep {
  seq: number;
  leg_type: string;
  status: "done" | "current" | "upcoming";
  planned_start: string | null;
  planned_end: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  progress_pct?: number | null;
}

export interface OttoQCardNeed {
  svc: string;
  status: string;
  done_at?: string;
}

export interface OttoQVehicleCard {
  urgency: string | null;
  dispatch_due_at: string | null;
  needs: OttoQCardNeed[];
  steps: OttoQCardStep[];
  current_step: OttoQCardStep | null;
  next_step: OttoQCardStep | null;
}

export interface OttoQCardVehicle {
  vehicle_id: string;
  display_name: string;
  oem: string;
  model: string;
  operator: { id: string | null; name: string | null };
  state: string;
  soc: number;
  target_soc: number;
  card: OttoQVehicleCard | null;
}

export interface OttoQDepotCards {
  endpoint: string;
  contract_version: "1.0";
  depot_id: string;
  fleet_operator_id: string | null;
  sim_run_id: string | null;
  run_status: "running" | "paused" | null;
  sim_clock: string | null;
  vehicles: OttoQCardVehicle[];
}

// fleetOperatorId is accepted for future owner-binding (unused for now).
export function useOttoqCards(fleetOperatorId?: string) {
  return useQuery<OttoQDepotCards>({
    queryKey: ["ottoq-depot-cards", DEPOT_ID, fleetOperatorId ?? null],
    queryFn: () =>
      ottoqRpc<OttoQDepotCards>("ottoq_depot_cards", {
        p_depot_id: DEPOT_ID,
        ...(fleetOperatorId ? { p_fleet_operator_id: fleetOperatorId } : {}),
      }),
    refetchInterval: 15000,
    staleTime: 10_000,
  });
}

// Map a vehicle_id to its entry in the single depot-wide payload.
// Returns null when there is no live run or the vehicle isn't in the payload.
export function selectCardFor(
  data: OttoQDepotCards | undefined,
  vehicleId: string
): OttoQCardVehicle | null {
  if (!data?.sim_run_id || !data.vehicles?.length) return null;
  return data.vehicles.find((v) => v.vehicle_id === vehicleId) ?? null;
}
