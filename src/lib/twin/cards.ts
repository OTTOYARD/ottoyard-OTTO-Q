// ============================================================================
// Read contracts the twin cockpit does not type itself.
//
//   ottoq_depot_cards 1.1   otto-q-core db/migrations/0460_*  (the ONE per-vehicle
//                           read contract both cockpits project; the operator
//                           filter is the only difference between them)
//   ottoq_activity_feed     otto-q-core (0079 + 0452..0457): "vehicle -> target, why"
//   ottoq_twin_appointments reservations / inbound / overnight headline
// ============================================================================

export interface CardNeed {
  svc: string;
  status: string;
  done_at?: string;
  must_do?: boolean;
}

export interface CardStep {
  seq: number;
  leg_type: string;
  status: "done" | "current" | "upcoming";
  planned_start: string | null;
  planned_end: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  progress_pct?: number | null;
}

export interface VehicleWorkCard {
  urgency: string | null;
  dispatch_due_at: string | null;
  needs: CardNeed[];
  steps: CardStep[];
  current_step: CardStep | null;
  next_step: CardStep | null;
}

export interface CardReservation {
  booking_id: string;
  purpose: string;
  state: string; // held | active
  stall_code: string | null;
  stall_kind: string | null;
  starts_at: string | null;
  ends_at: string | null;
  why: string | null;
  need_atom: string | null;
  booked_by: string | null;
}

export interface CardDecision {
  at: string | null;
  action: string | null;
  verb: string | null;
  outcome: string | null;
  engine: string | null;
  rationale: Record<string, unknown> | null;
}

export interface CardVehicle {
  vehicle_id: string;
  display_name: string;
  oem: string | null;
  model: string | null;
  operator: { id: string | null; name: string | null };
  state: string;
  soc: number | null;
  target_soc: number | null;
  /** 1.1 */ stall: { id: string; code: string | null; kind: string | null } | null;
  /** 1.1 */ reservations: CardReservation[];
  /** 1.1 */ last_decision: CardDecision | null;
  card: VehicleWorkCard | null;
}

/** One row of the depot reservation board: a per-vehicle reservation with its vehicle attached. */
export interface DepotReservation extends CardReservation {
  vehicle_id: string;
  display_name: string;
  operator: string | null;
}

export interface DepotCardsResponse {
  endpoint: string;
  contract_version: string;
  depot_id: string;
  fleet_operator_id: string | null;
  /** NULL means no run is live on the depot. Every panel renders an honest empty state then. */
  sim_run_id: string | null;
  run_status: "running" | "paused" | null;
  sim_clock: string | null;
  vehicles: CardVehicle[];
  /** 1.1: this run's bookings by state (done / released / superseded / interrupted / held / active). */
  reservation_ledger?: Record<string, number>;
}

export interface ActivityRow {
  occurred_at: string;
  vehicle_id: string | null;
  display_name: string | null;
  action: string | null;
  engine: string | null;
  target: string | null;
  outcome: string | null;
  rationale: Record<string, unknown> | null;
  reason: string | null;
  decision_seq: number;
  tick_seq: number | null;
  held_ticks: number | null;
  last_at: string | null;
  standing: boolean | null;
}

export interface AppointmentsResponse {
  sim_run_id: string;
  sim_clock: string | null;
  hour_cst: number | null;
  headline: {
    fleet_total: number;
    charge_stalls: number;
    inbound_count: number;
    veh_per_charger: number | null;
    reservations_held: number;
    unsafe_deploys_run: number;
    booked_before_arrival: number;
  };
  phases: Record<string, number>;
  inbound: Record<string, unknown>[];
  reservations: Record<string, unknown>[];
  overnight: Record<string, unknown>;
}
