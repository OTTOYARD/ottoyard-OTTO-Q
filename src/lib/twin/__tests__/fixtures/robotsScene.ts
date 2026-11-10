// A depot scene for the robots' tests: six fast chargers and three wash bays, each in one of the states the engine
// can publish.
//
// BUILT BY HAND from the engine's published shapes, because no run is live while this is written and the repo's
// captures predate the cleaning arm and the wash machine. Every row has the keys and the values the engine writes:
// the first five stall ids and all the codes are the twin depot's own (its layout, read 2026-11-09), the atoms are
// shaped as public.ottoq_twin_snapshot builds them (otto-q-core 0512, 0758), the stall rows as 0612 and the tether
// patch build them, the arm block is run a0001fd6's own (its snapshot, read 2026-11-09) with two cycles opened for
// the scene, the card steps are shaped as public.ottoq_depot_cards 1.5 builds them, and the counts in EVENTS and KPI
// are that run's own (ottoq_twin_events_window, ottoq_twin_kpi_board, read the same day).
import type { CardNeed, CardStep, CardVehicle, DepotCardsResponse } from "../../cards";
import type { TwinEventsWindow, TwinKpiBoard, TwinLayout, TwinSnapshot, TwinVisitAtom } from "../../types";

export const RUN = "a0001fd6-4a12-45a9-b47a-98f80c3d14dc";
export const CLOCK = "2026-11-07T16:05:00+00:00"; // 10:05 AM in Nashville

// the twin depot's own stalls (ottoq_twin_depot_layout, read 2026-11-09)
export const P01 = "765adddb-3dc3-4cd4-be62-28c76ed8e737"; // NASH-DCFC-STALL-01
export const P02 = "6b043f2d-e7b5-485b-beb1-3e7b7c283964";
export const P03 = "3f2338b8-5844-4bc3-a7d9-152439279fcd";
export const P04 = "f0d61886-45fa-4187-acb0-9560f85390cb";
export const P05 = "87f204a1-c4eb-43ba-85f9-5d967f91b706";
export const P06 = "00000000-0000-4000-8000-000000000006";
export const W1 = "00000000-0000-4000-8000-0000000000a1";
export const W2 = "00000000-0000-4000-8000-0000000000a2";
export const W3 = "00000000-0000-4000-8000-0000000000a3";
const stall = (id: string, code: string, type: string, canopy: string | null = null) =>
  ({ id, code, type, zone: type === "dcfc" ? "dcfc_zone" : "cleaning", canopy, covered: true, x: 0, y: 0, heading: 0, connector_kw: type === "dcfc" ? 350 : null });
export const layout: TwinLayout = {
  depot: { id: "11111111-1111-1111-1111-111111111111", name: "OTTOYARD Nashville Flagship", origin_lat: 36.1397, origin_lng: -86.7728 },
  structures: [],
  stalls: [
    // out of order on purpose: the board sorts by code
    stall(P03, "NASH-DCFC-STALL-03", "dcfc", "CANOPY-01"), stall(P01, "NASH-DCFC-STALL-01", "dcfc", "CANOPY-01"),
    stall(P02, "NASH-DCFC-STALL-02", "dcfc", "CANOPY-01"), stall(P04, "NASH-DCFC-STALL-04", "dcfc", "CANOPY-01"),
    stall(P05, "NASH-DCFC-STALL-05", "dcfc", "CANOPY-01"), stall(P06, "NASH-DCFC-STALL-06", "dcfc", "CANOPY-01"),
    stall(W1, "NASH-WSH-01", "wash_bay"), stall(W2, "NASH-WSH-02", "wash_bay"), stall(W3, "NASH-WSH-03", "wash_bay"),
    stall("s-1", "NASH-STG-S001", "staging"),
  ],
};

export const atom = (svc: string, status: string, extra: Partial<TwinVisitAtom> = {}): TwinVisitAtom =>
  ({ svc, status, must_do: true, est_min: null, performed_by: null, awaiting_triage: false, triage_verdict: null, started_at: null, ends_at: null, done_at: null, robot_stall_id: null, ...extra });
export const visit = (atoms: TwinVisitAtom[]) =>
  ({ visit_id: "vis", visit_status: "in_progress", archetype: null, urgency: "standard", arrived_at: null, target_soc: 100, soc_at_arrival: 40, est_charge_min: 25, atoms });
const car = (id: string, av: string, state: string, stall_id: string | null, extra: Record<string, unknown> = {}) =>
  ({ id, av_id: av, make: "Waymo", platform: "I-PACE", state, soc: 60, stall_id, bay_seat: null, visit: null, ...extra });

export const snapshot = {
  run: { sim_run_id: RUN, scenario: "busy_day", status: "running", sim_clock: CLOCK, tick_count: 400, time_scale: 60, seed: "2117995815598180396" },
  fleet: {
    counts: {}, total: 9,
    vehicles: [
      // P01: charging, the charge arm connected, the cleaning arm 3 of 5.8 minutes in
      car("v1", "Waymo-005", "charging_dcfc", P01, {
        visit: visit([
          atom("charge", "pending"),
          atom("interior_inspection", "in_progress", { performed_by: "charger_sensors", started_at: "2026-11-07T16:02:00+00:00", ends_at: "2026-11-07T16:06:00+00:00" }),
          atom("interior_tidy", "in_progress", { performed_by: "stall_cabin_robot", robot_stall_id: P01, started_at: "2026-11-07T16:02:00+00:00", ends_at: "2026-11-07T16:07:48+00:00" }),
          atom("exterior_wash", "pending"),
        ]),
      }),
      // P02: the charge arm reaching in, on its first retry
      car("v2", "Zoox-011", "charging_dcfc", P02, { visit: visit([atom("charge", "pending")]) }),
      // P04: charge over, the arm pulling out; its clean finished at 9:58
      car("v4", "Tesla-AV-041", "charge_complete_holding", P04, {
        visit: visit([
          atom("charge", "done", { done_at: "2026-11-07T16:04:40+00:00" }),
          atom("interior_tidy", "done", { performed_by: "stall_cabin_robot", robot_stall_id: P04, started_at: "2026-11-07T15:52:12+00:00", ends_at: "2026-11-07T15:58:00+00:00", done_at: "2026-11-07T15:58:00+00:00" }),
        ]),
      }),
      // P05 is held for an inbound car; P06 is free. A car that was cleaned at P05 earlier now stands in staging.
      car("v5", "Waymo-020", "staged_for_departure", "s-1", {
        visit: visit([
          atom("charge", "done", { done_at: "2026-11-07T15:31:51+00:00" }),
          atom("interior_inspection", "done", { performed_by: "charger_sensors", done_at: "2026-11-07T15:14:00+00:00" }),
          atom("interior_tidy", "done", { performed_by: "stall_cabin_robot", robot_stall_id: P05, started_at: "2026-11-07T15:10:00+00:00", ends_at: "2026-11-07T15:15:48+00:00", done_at: "2026-11-07T15:15:48+00:00" }),
          atom("exterior_wash", "done", { done_at: "2026-11-07T15:41:19+00:00" }),
        ]),
      }),
      car("v6", "Zoox-002", "en_route_to_depot", null),
      // W1: a wash 2 of 5 minutes in. W2: a detail seat. W3: a seat whose timer has run out.
      car("v7", "Waymo-031", "in_wash_bay", W1, { bay_seat: { since: "2026-11-07T16:03:00+00:00", ends_at: "2026-11-07T16:08:00+00:00" }, visit: visit([atom("exterior_wash", "in_progress")]) }),
      car("v8", "Tesla-AV-007", "in_detail_bay", W2, { bay_seat: { since: "2026-11-07T15:55:00+00:00", ends_at: "2026-11-07T16:11:30+00:00" }, visit: visit([atom("interior_deep_clean", "in_progress")]) }),
      car("v9", "Zoox-019", "in_wash_bay", W3, { bay_seat: { since: "2026-11-07T15:59:00+00:00", ends_at: "2026-11-07T16:04:00+00:00" } }),
      // a technician's tidy on a parked car: no machine
      car("v10", "Waymo-044", "staged_awaiting_service", null, { visit: visit([atom("interior_tidy", "in_progress", { started_at: "2026-11-07T16:01:00+00:00", ends_at: "2026-11-07T16:06:00+00:00" })]) }),
    ],
  },
  stalls_status: [
    // through a charge the hold is a 120-second lease the engine renews: tether_until is not the charge's end
    { id: P01, status: "occupied", vehicle_id: "v1", charger_state: "Charging", fault_code: null, fault_until: null, reserved_by: null, reserved_until: null, tethered: true, tether_until: "2026-11-07T16:07:00+00:00", tether_direction: "charging", tether_phase: "charging" },
    { id: P02, status: "occupied", vehicle_id: "v2", charger_state: "Occupied", fault_code: null, fault_until: null, reserved_by: null, reserved_until: null, tethered: true, tether_until: "2026-11-07T16:05:20+00:00", tether_direction: "mate", tether_phase: "align" },
    { id: P03, status: "faulted", vehicle_id: null, charger_state: "Faulted", fault_code: "fault.connector_cable", fault_until: "2026-11-07T19:27:51.149855+00:00", reserved_by: null, reserved_until: null, tethered: false, tether_until: null, tether_direction: null, tether_phase: null },
    // the car no longer points at the stall while the arm pulls out: the tether is what keeps the stall in the payload
    { id: P04, status: "available", vehicle_id: null, charger_state: "Finishing", fault_code: null, fault_until: null, reserved_by: null, reserved_until: null, tethered: true, tether_until: "2026-11-07T16:05:08+00:00", tether_direction: "demate", tether_phase: "extract" },
    { id: P05, status: "available", vehicle_id: null, charger_state: "Available", fault_code: null, fault_until: null, reserved_by: "v6", reserved_until: "2026-11-07T16:20:00+00:00", tethered: false, tether_until: null, tether_direction: null, tether_phase: null },
    { id: W1, status: "occupied", vehicle_id: "v7", reserved_by: null, reserved_until: null, tethered: false },
    { id: W2, status: "occupied", vehicle_id: "v8", reserved_by: null, reserved_until: null, tethered: false },
    { id: W3, status: "occupied", vehicle_id: "v9", reserved_by: null, reserved_until: null, tethered: false },
  ],
  arm: {
    // run a0001fd6's own arm block (snapshot read 2026-11-09), with two cycles opened for this scene
    timings: { source: "ottoq_policy_params", demate_source: "derived", phase_seconds: { align: 4.5, latch: 2, insert: 3, unstow: 3, extract: 3, retract: 6.5, unlatch: 2, approach: 6 }, demate_seconds: 11.5, connect_seconds: 18.5, cycle_overhead_seconds: 30 },
    accuracy: { cycles: 220, latched: 220, retried: 9, attempts: 229, tolerance: { yaw_deg: 2.5, lateral_mm: 12, vertical_mm: 12 }, restage_required: 0, error_yaw_deg_p95: 0.713, fiducial_seen_pct: 95.63, error_radial_mm_max: 82.67, error_radial_mm_p50: 3.7, error_radial_mm_p95: 8.73, first_pass_yield_pct: 95.91 },
    cycles: [
      { cycle_id: "c2", stall_id: P02, vehicle_id: "v2", direction: "mate", phase: "align", phase_deadline: "2026-11-07T16:05:04+00:00", started_at: "2026-11-07T16:04:50+00:00", retry_count: 1 },
      { cycle_id: "c4", stall_id: P04, vehicle_id: "v4", direction: "demate", phase: "extract", phase_deadline: "2026-11-07T16:05:02+00:00", started_at: "2026-11-07T16:04:57+00:00", retry_count: 0 },
    ],
  },
  energy: null, bess: null, weather: null, grid: null, counters: {}, recent_events: [], variability: {},
} as unknown as TwinSnapshot;

/** A step as public.ottoq_depot_cards 1.5 builds it: `at` is the station, `t` the planned and actual times. */
export const step = (seq: number, leg_type: string, status: CardStep["status"], extra: Partial<CardStep> = {}): CardStep =>
  ({ seq, leg_type, status, atom: null, to_stall_code: null, to_stall_kind: null, planned_start: null, planned_end: null, ...extra });
const at = (code: string, kind: string) => ({ to_stall_code: code, to_stall_kind: kind });
const ran = (from: string, to: string) => ({ planned_start: from, planned_end: to, actual_start: from, actual_end: to });

// v1, charging now. The card holds ONE step under way (the first active leg): the cabin clean and the sensors'
// inspection, which run during the charge, are not among its steps until they are done.
export const STEPS_V1: CardStep[] = [
  step(1, "taxi", "done", { ...at("NASH-DCFC-STALL-01", "charging"), ...ran("2026-11-07T16:01:00+00:00", "2026-11-07T16:01:34+00:00") }),
  step(2, "charge_dcfc", "current", {
    ...at("NASH-DCFC-STALL-01", "charging"), planned_start: "2026-11-07T16:01:40+00:00", planned_end: "2026-11-07T16:38:00+00:00",
    actual_start: "2026-11-07T16:01:40+00:00", expected_end: "2026-11-07T16:40:00+00:00", eta_source: "charge_physics", progress_pct: 9, over_plan_min: null,
  }),
  step(6, "wash", "upcoming", { atom: "exterior_wash", ...at("NASH-WSH-01", "wash"), planned_start: "2026-11-07T16:42:00+00:00", planned_end: "2026-11-07T16:47:19+00:00", overdue_min: null }),
  step(7, "inspect", "upcoming", { atom: "readiness_check", planned_start: "2026-11-07T16:48:00+00:00", planned_end: "2026-11-07T16:51:00+00:00", overdue_min: null }),
];

// v5, a whole visit behind it. The legs are shaped as two of run a0001fd6's own itineraries are (read 2026-11-09):
// 2490ff17 holds a planned interior tidy the engine closed with no duration when the stall's arm took the work and
// wrote its own leg; cb40d135 has its wash recorded after the drive that follows it.
export const STEPS_V5: CardStep[] = [
  step(1, "taxi", "done", { ...at("NASH-DCFC-STALL-05", "charging"), ...ran("2026-11-07T15:09:00+00:00", "2026-11-07T15:09:34+00:00") }),
  step(2, "charge_dcfc", "done", { ...at("NASH-DCFC-STALL-05", "charging"), planned_start: "2026-11-07T15:09:40+00:00", planned_end: "2026-11-07T15:29:10+00:00", actual_start: "2026-11-07T15:09:40+00:00", actual_end: "2026-11-07T15:31:51+00:00" }),
  step(3, "interior_tidy", "done", { atom: "interior_tidy", ...at("NASH-DCFC-STALL-05", "charging"), planned_start: "2026-11-07T15:09:50+00:00", planned_end: "2026-11-07T15:13:50+00:00", actual_start: "2026-11-07T15:10:00+00:00", actual_end: "2026-11-07T15:10:00+00:00" }),
  step(4, "inspect", "done", { atom: "interior_inspection", ...at("NASH-DCFC-STALL-05", "charging"), ...ran("2026-11-07T15:10:00+00:00", "2026-11-07T15:14:00+00:00") }),
  step(5, "interior_tidy", "done", { atom: "interior_tidy", ...at("NASH-DCFC-STALL-05", "charging"), ...ran("2026-11-07T15:10:00+00:00", "2026-11-07T15:15:48+00:00") }),
  step(6, "taxi", "done", { ...at("NASH-STG-S001", "staging"), ...ran("2026-11-07T15:41:30+00:00", "2026-11-07T15:42:10+00:00") }),
  step(7, "wash", "done", { atom: "exterior_wash", ...at("NASH-WSH-02", "wash"), ...ran("2026-11-07T15:36:00+00:00", "2026-11-07T15:41:19+00:00") }),
  step(8, "depart", "upcoming", { ...at("NASH-STG-S001", "staging"), planned_start: "2026-11-07T16:30:00+00:00", planned_end: "2026-11-07T16:30:40+00:00", overdue_min: null }),
];

const cardOf = (id: string, name: string, op: string, state: string, code: string | null, kind: string | null, needs: CardNeed[] = [], steps: CardStep[] = []): CardVehicle =>
  ({
    vehicle_id: id, display_name: name, oem: "Waymo", model: "I-PACE", operator: { id: op, name: op === "op-w" ? "Waymo Nashville" : op === "op-z" ? "Zoox Southeast" : "Tesla Robotaxi TN" },
    state, soc: 60, target_soc: 100, stall: code ? { id: "x", code, kind } : null, reservations: [], last_decision: null,
    card: {
      urgency: "standard", dispatch_due_at: null, needs, steps,
      current_step: steps.find((x) => x.status === "current") ?? null, next_step: steps.find((x) => x.status === "upcoming") ?? null,
    },
  });
export const cards: DepotCardsResponse = {
  endpoint: "ottoq.depot_cards", contract_version: "1.5", depot_id: layout.depot!.id, fleet_operator_id: null,
  sim_run_id: RUN, run_status: "running" as const, sim_clock: CLOCK,
  vehicles: [
    cardOf("v1", "Waymo-005", "op-w", "charging_dcfc", "NASH-DCFC-STALL-01", "charging", [
      { svc: "charge", status: "pending", must_do: true },
      { svc: "interior_inspection", status: "in_progress", must_do: true, performed_by: "charger_sensors", started_at: "2026-11-07T16:02:00+00:00", ends_at: "2026-11-07T16:06:00+00:00" },
      { svc: "interior_tidy", status: "in_progress", must_do: true, performed_by: "stall_cabin_robot", started_at: "2026-11-07T16:02:00+00:00", ends_at: "2026-11-07T16:07:48+00:00" },
      { svc: "exterior_wash", status: "pending", must_do: true },
    ], STEPS_V1),
    cardOf("v2", "Zoox-011", "op-z", "charging_dcfc", "NASH-DCFC-STALL-02", "charging"),
    cardOf("v4", "Tesla-AV-041", "op-t", "charge_complete_holding", "NASH-DCFC-STALL-04", "charging"),
    cardOf("v5", "Waymo-020", "op-w", "staged_for_departure", "NASH-STG-S001", "staging", [
      { svc: "charge", status: "done", must_do: true, done_at: "2026-11-07T15:31:51+00:00" },
      { svc: "interior_inspection", status: "done", must_do: true, performed_by: "charger_sensors", done_at: "2026-11-07T15:14:00+00:00" },
      { svc: "interior_tidy", status: "done", must_do: true, performed_by: "stall_cabin_robot", started_at: "2026-11-07T15:10:00+00:00", ends_at: "2026-11-07T15:15:48+00:00", done_at: "2026-11-07T15:15:48+00:00" },
      { svc: "exterior_wash", status: "done", must_do: true, done_at: "2026-11-07T15:41:19+00:00" },
    ], STEPS_V5),
    cardOf("v6", "Zoox-002", "op-z", "en_route_to_depot", null, null),
    cardOf("v7", "Waymo-031", "op-w", "in_wash_bay", "NASH-WSH-01", "wash"),
    cardOf("v8", "Tesla-AV-007", "op-t", "in_detail_bay", "NASH-WSH-02", "wash"),
    cardOf("v9", "Zoox-019", "op-z", "in_wash_bay", "NASH-WSH-03", "wash"),
    cardOf("v10", "Waymo-044", "op-w", "staged_awaiting_service", null, null),
  ],
};

// run a0001fd6's own counts (ottoq_twin_events_window and ottoq_twin_kpi_board, read 2026-11-09)
export const EVENTS = { by_type: { "arm.mate_started": 220, "arm.mate_latched": 220, "arm.demate_started": 184, "arm.demate_cleared": 183, "arm.emergency_release": 11, "charge.session_faulted": 15 } } as unknown as TwinEventsWindow;
export const KPI = {
  ok: true,
  service: {
    steps: 1118, done: 797, required: 1118, required_done: 797, required_open: 309, cancelled: 12,
    by_service: [
      { svc: "interior_tidy", done: 204, lane: "cabin", name: "Interior tidy", total: 215 },
      { svc: "interior_deep_clean", done: 22, lane: "detail", name: "Interior deep clean", total: 26 },
      { svc: "exterior_wash", done: 17, lane: "wash_bay", name: "Exterior wash", total: 17 },
    ],
  },
} as unknown as TwinKpiBoard;
