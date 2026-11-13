// ============================================================================
// OTTO-TWIN wire types, copied VERBATIM from the twin cockpit so the three
// cockpits read one contract.
//   source: OTTOYARD/ottoyarddepot-sim  src/lib/ottoTwin.ts  lines 18-622 and 681-735
//   commit: 7607931
// Do not edit these by hand. If the twin's contract moves, re-copy the blocks
// and re-run src/lib/twin/__tests__ (the fixtures are real captures).
//
// Re-copied 2026-11-09 for the depot's robots: a visit atom's times and the stall whose
// cleaning arm does it (otto-q-core 0758), a car's seat in a wash bay (0762), a faulted
// charger's code and repair time (0612), and the KPI board (0609-0611).
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types (mirror ottoq_twin_snapshot / ottoq_twin_depot_layout) ──
export interface TwinStall {
  id: string; code: string; type: string; zone: string | null;
  canopy: string | null; covered: boolean | null;
  x: number; y: number; heading: number; connector_kw: number | null;
}
export interface TwinStructure {
  code: string; kind: string; title: string;
  x_ft: number; y_ft: number; width_ft: number; length_ft: number; rotation_deg: number;
}
export interface TwinLayout {
  depot: { id: string; name: string; origin_lat: number; origin_lng: number } | null;
  structures: TwinStructure[];
  stalls: TwinStall[];
}

/**
 * One service ATOM on a visit — OTTO-Q's own unit of work, published verbatim
 * from `ottoq_visit_needs.atoms`. This is the bullet list on the vehicle card,
 * and `status` is its checkbox.
 *
 * `status` is an OPEN SET, deliberately typed as `string`. The backend
 * lower-cases it and defaults a missing key to 'pending' — the same
 * COALESCE(status,'pending') the decision loop itself uses — but new states can
 * appear in the sim before they appear here, and a renderer that narrowed this
 * to a union would either crash or silently mis-file them. Classify with
 * `readVisitWorkflow` in `@/lib/visitWorkflow`, which is total over any string.
 * Observed today: pending | in_progress | done | cancelled | skipped.
 */
export interface TwinVisitAtom {
  svc: string;
  status: string;
  must_do: boolean;
  /** OTTO-Q's estimate for this atom, minutes. NULL when the atom carried none. */
  est_min: number | null;
  /**
   * Who performed it (otto-q-core 0512, G236): 'charger_sensors' when the charger's own sensors did the work during
   * the charge (an interior inspection, a cabin-only triage), 'stall_cabin_robot' when the stall's OTTO-CLEAN ARM did
   * (0758), null for a technician. Absent before 0512.
   */
  performed_by?: string | null;
  /** 0512: a pending need that waits on the triage check's verdict (confirm, clear or escalate), not on a technician. */
  awaiting_triage?: boolean;
  /** 0512: the triage check's verdict once given: 'confirm' | 'clear' | 'escalate'. */
  triage_verdict?: string | null;
  /**
   * When the work started, ends and was done: the BACKEND's sim clock (ISO), as the
   * engine wrote them (otto-q-core 0758). Absent from an older backend; null when the
   * atom carries none.
   */
  started_at?: string | null;
  ends_at?: string | null;
  done_at?: string | null;
  /** The twin stall whose OTTO-CLEAN ARM does this work (an interior tidy during a fast charge), or null. */
  robot_stall_id?: string | null;
}

/**
 * The OPEN visit for one vehicle — what OTTO-Q decided this car came in for and
 * how far through that plan it is.
 *
 * Every field is READ, never derived client-side: `target_soc`, `urgency` and
 * `archetype` are columns on `ottoq_visit_needs`; `soc_at_arrival` is stamped
 * into `meta` by the needs generator; `est_charge_min` is lifted off the CHARGE
 * atom's own `est_min`, so the number on the card is the number OTTO-Q planned
 * against rather than a second opinion computed here.
 */
export interface TwinVisitCard {
  visit_id: string;
  /** 'open' | 'in_progress' — the ROW's status, not any atom's. */
  visit_status: string;
  archetype: string | null;
  urgency: string | null;
  arrived_at: string | null;
  target_soc: number | null;
  /** SoC the vehicle ENTERED the depot on. NULL when the visit never stamped it. */
  soc_at_arrival: number | null;
  /** NULL is meaningful: this visit has no charge atom, i.e. no charge planned. */
  est_charge_min: number | null;
  atoms: TwinVisitAtom[];
}

export interface TwinVehicle {
  id: string; av_id: string; make: string; platform: string;
  state: string; soc: number; stall_id: string | null;
  /** The vehicle's model, and where its charge inlet is (otto-q-core 0824). `port` is null for a car with no port
   *  profile, and absent from a backend older than 0824. Metres; `along_m` is from the middle of the car, positive
   *  toward the nose. */
  model?: string | null;
  port?: {
    profile: string; face: 'left' | 'right' | 'rear'; along_m: number; height_m: number; lateral_m: number;
    connector: 'CCS1' | 'NACS'; either_side: boolean; assumed: boolean; length_m: number; width_m: number;
  } | null;
  /**
   * The vehicle's open visit workflow. THREE distinct readings, and collapsing
   * any two of them would put a claim on screen that OTTO-Q never made:
   *   `undefined` — the backend predates this field. NOTHING is known about the
   *                 car's workflow. Render "no workflow published".
   *   `null`      — the backend published, and this car has NO open visit for
   *                 this run (it is off-site, or between visits).
   *   an object   — the open visit, atoms and all.
   * An open visit whose `atoms` array is empty is a fourth, real state: OTTO-Q
   * opened a visit and put no work on it. That is not the same as `null`.
   */
  visit?: TwinVisitCard | null;
  /**
   * The car's seat in a wash, detail or service bay (otto-q-core 0762): when the twin seated it
   * and when its timer ends the work there, both ISO on the BACKEND's sim clock. Null for a car
   * in no bay; absent from an older backend. `ends_at` is null when the twin's timer is unset.
   */
  bay_seat?: { since: string | null; ends_at: string | null } | null;
}
/**
 * One timed leg of a vehicle's itinerary — the twin's T3 RENDER CONTRACT.
 *
 * The backend has published these on every snapshot since the t3_* migrations
 * and the client ignored them entirely, inventing motion from stall state
 * instead. They are also the only per-visit SERVICE TIMING on the wire, which
 * is what `depot_ops.service_timers` is built from.
 *
 * `kind` records how the DURATION WAS DERIVED, not what the service is:
 *   charge_curve   a physical charge model
 *   distribution   sampled from a fitted real-world corpus
 *   flow_contract  a policy or contract
 *   travel         taxiing between places — the only non-service kind
 * `leg_type` is the actual service classifier.
 *
 * So `kind:'travel'` legs are the movements the renderer drives; every other
 * kind is a DWELL at a location.
 */
export interface TwinLeg {
  leg_id: string;
  vehicle_id: string;
  seq: number;
  leg_type: string;              // taxi | depart | arrive | stage | charge_* | wash | ...
  intent: string | null;         // taxi_to_charger | taxi_to_gate | taxi_to_wash | exit_*_to_staging
  kind: string;                  // 'travel' = a movement; anything else is a dwell
  from_stall: string | null;     // NULL on a travel leg = entering from OFF-MAP (drive in via the gate)
  to_stall: string | null;
  from_x: number | null; from_y: number | null;   // backend frame — diagnostics only, see note above
  to_x: number | null;   to_y: number | null;
  // nullable on the wire: a leg can be published before its window is stamped
  start_sim: string | null;      // planned_start_sim (ISO)
  end_sim: string | null;        // planned_end_sim   (ISO)
  duration_s: number | null;
  status: string;                // planned | active | done | skipped | amended
  geometry: string;              // measured | arrival_from_offmap | origin_unresolved | bay_geometry_missing
}

/** Server half of the render-contract coverage ratio. */
export interface TwinLegsMeta {
  open_travel_legs: number;
  vehicles_with_open_leg: number;
  closed_this_run: number;
  /** how far realized travel drifted from plan, seconds; negative = early */
  median_deviation_s: number | null;
}

export interface TwinSnapshot {
  run: {
    sim_run_id: string; scenario: string; status: string;
    /** text from engine 0497 on: a 64-bit seed is not exact as a JS number */
    sim_clock: string; tick_count: number; time_scale: number; seed: number | string;
    /** PLAYBACK CONTRACT (backend `ottoq_set_playback`).
     *  'live'  = 1 real second advances the sim clock by speed_x sim seconds (1:1 at 1x)
     *  'fixed' = historical tick_interval_seconds * time_scale (certs/benchmarks) */
    playback_mode?: 'live' | 'fixed';
    /** 1..3. Capped backend-side; beyond 3 the operator JUMPS instead of speeding up. */
    speed_x?: number;
    /** Present ONLY while a fast-forward is in flight — drives the planning pause. */
    jump?: {
      status: 'planning';
      target_sim_clock: string;
      from_sim_clock: string;
      prev_mode: 'live' | 'fixed';
    } | null;
    last_tick_at?: string | null;
    next_tick_due_at?: string | null;
    server_now?: string;
  };
  /** T3/T4 RENDER CONTRACT. Timed legs published by the backend
   *  (`ottoq_itinerary_legs` via `ottoq_twin_snapshot`), filtered server-side to
   *  the active window. The renderer INTERPOLATES these; it must never invent a
   *  movement the contract did not specify.
   *
   *  ⚠️ USE `to_stall` / `from_stall`, NOT `to_x` / `to_y`. The coordinates are in the
   *  BACKEND's site frame (feet, SW origin) which is a DIFFERENT depot layout from
   *  the renderer's sitePlan — no transform exists between them. The stall UUIDs are
   *  the only safe join, via TwinMotionDriver.setTwinStallMap (matched on stall_code).
   *  The x/y are carried for diagnostics and for a future Isaac consumer that renders
   *  in the backend frame. */
  legs?: TwinLeg[];
  legs_meta?: TwinLegsMeta;
  fleet: { counts: Record<string, number>; total: number; vehicles: TwinVehicle[] };
  /** `tethered` is true while the OTTO-CHARGE ARM is still mechanically mated to the
   *  vehicle at this stall — the ~11.5 s demate window AFTER StopTransaction, during
   *  which OTTO-Q refuses to move the car anywhere. `tether_until` is the sim-clock
   *  deadline the arm finishes retracting, so the retract can be animated against the
   *  same clock the legs use. Both are optional: an older backend omits them and every
   *  consumer must read that as "not tethered". */
  stalls_status: {
    id: string;
    status: string;
    vehicle_id: string | null;
    tethered?: boolean;
    tether_until?: string | null;
    /** 'mate' (reaching in), 'charging' (locked, delivering), 'demate' (pulling out).
     *  `tethered` alone is now true in all three, and they animate differently — an
     *  inbound reach is not a release countdown. Absent on an older backend, where
     *  every tether was a demate, so undefined must read as 'demate'. */
    tether_direction?: string | null;
    /** The backend's authoritative ArmPhase at this stall. Absent reads as unknown,
     *  never as 'clear'. */
    tether_phase?: string | null;
    /** The vehicle OTTO-Q is HOLDING this stall for, when it is holding it for one.
     *  Published only for LIVE reservations (checked against the sim clock the
     *  expiry was written in), so an expired hold never arrives as an instruction.
     *  Without this the renderer could see that a stall was reserved but not who
     *  for, and fell back to choosing a staging stall itself. */
    reserved_by?: string | null;
    reserved_until?: string | null;
    /** The stall's OCPP charger state (otto-q-core 0612): "Faulted" when the charger is down,
     *  else "Available", "Charging" and so on. A Faulted charger's stall is listed even while
     *  the stall itself reads available, with `status` 'faulted'. Absent on an older backend,
     *  and null on a stall with no charger: neither means healthy. */
    charger_state?: string | null;
    /** Why the charger is down, e.g. "fault.communication_dropout". An open set. */
    fault_code?: string | null;
    /** SIM-clock instant the drawn repair ends; null when the twin has no end for it. */
    fault_until?: string | null;
  }[];
  /** THE ARM CONTRACT (`public.ottoq_arm_timings` via the snapshot RPC).
   *
   *  The OTTO-CHARGE ARM's motion budget has ONE home, and it is a set of
   *  `ottoq_policy_params` rows in otto-q-core — not `armStateMachine.ts`, which
   *  now reads these and keeps its own literals only as an offline floor. Retune
   *  the arm in one place and both worlds move: the renderer's animation and the
   *  window OTTO-Q reserves the plug for.
   *
   *  Optional: an older backend omits the block and every consumer must read that
   *  as "keep the shipped defaults", never as "the arm takes zero seconds". */
  arm?: {
    timings?: {
      phase_seconds?: Record<string, number> | null;
      connect_seconds?: number | null;
      /** What OTTO-Q actually reserves the plug for after StopTransaction. */
      demate_seconds?: number | null;
      cycle_overhead_seconds?: number | null;
      /** 'derived' from its three phases, 'override' when pinned, 'fallback' on a failed read. */
      demate_source?: string | null;
      source?: string | null;
    } | null;
    /** REGISTRATION ACCURACY (`twin.ottoq_arm_accuracy`). Millimetres between where
     *  the arm believed the inlet was and where it actually was, and how often that
     *  was close enough to latch on the first reach.
     *
     *  `attempts: 0` with null statistics means NOTHING WAS MEASURED. It does not
     *  mean perfect accuracy, and a consumer that renders it as 100% is lying about
     *  an idle depot. */
    accuracy?: {
      attempts: number;
      cycles?: number;
      /** Share of first reaches that latched without a retry. Null when none yet. */
      first_pass_yield_pct?: number | null;
      latched?: number;
      retried?: number;
      /** Cars parked outside the envelope the arm can serve — no retry can fix these. */
      restage_required?: number;
      fiducial_seen_pct?: number | null;
      error_radial_mm_p50?: number | null;
      error_radial_mm_p95?: number | null;
      error_radial_mm_max?: number | null;
      error_yaw_deg_p95?: number | null;
      tolerance?: {
        lateral_mm: number | null;
        vertical_mm: number | null;
        yaw_deg: number | null;
      } | null;
    } | null;
    /** OPEN arm cycles — the inbound half the cockpit could not see at all before
     *  `the_arm_holds_the_car_from_approach_until_clear`. One entry per stall whose
     *  robot is mid-mate or mid-demate, including which retry it is on. Closed
     *  cycles are history and live in the event log, not here. */
    cycles?: {
      cycle_id: string;
      stall_id: string;
      vehicle_id: string;
      direction: string;
      phase: string;
      phase_deadline: string | null;
      started_at: string | null;
      retry_count: number;
    }[] | null;
  } | null;
  energy: Record<string, number | string | null> | null;
  bess: Record<string, number | string | null> | null;
  weather: Record<string, number | string | null> | null;
  grid: Record<string, number | string | boolean | null> | null;
  counters: Record<string, number>;
  recent_events: { type: string; severity: string; at: string; entity: string; payload: unknown }[];
  variability: Record<string, unknown>;
  error?: string;
}

// ── Events window (RPC `ottoq_twin_events_window`) ──
//
// `TwinSnapshot.recent_events` is a 15-row tail: a UI ticker. It cannot express
// a RATE, and rates are most of what a reliability model is. This aggregate is
// the same event log read as a SIGNAL: run-to-date counts, fault and delay
// rates, the observed charge curve, and the twin's own arrival forecast.
//
// Every derived statistic is `null` when its source set was empty. "We saw no
// faults" and "there were no sessions to fault" are different claims and must
// stay distinguishable — a 0 here would collapse them.

/** Latest `ottoq.arrival_forecast` — the twin's look-ahead, previously unread. */
export interface TwinDemandForecast {
  at: string | null;
  horizon_min: number | null;
  incoming_count: number | null;
  charge_needed_count: number | null;
  predicted_charge_kw: number | null;
  predicted_charge_kwh: number | null;
}

export interface TwinEventsWindow {
  window: {
    basis: string;
    signal_events: number;
    first_at: string | null;
    last_at: string | null;
    /** run's sim-time span; turns any count into a per-sim-hour rate */
    sim_minutes_elapsed: number | null;
  };
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  reliability: {
    charge_sessions: number;
    charge_faults: number;
    /** faults / sessions; null when nothing ever started */
    charge_fault_rate: number | null;
    fault_reasons: Record<string, number>;
    repair_minutes_total: number | null;
    arrival_delays: number;
    delay_min_p50: number | null;
    delay_causes: Record<string, number>;
    stranded_recharges: number;
    /** vehicles towed this run. Emitted by the backend on every window (verified
     *  0/1/2 across live fixtures); it was missing from THIS type while
     *  contracts.ts declared it, so channels.ts read it and CI caught the gap. */
    tow_events: number;
    exceptions_by_severity: Record<string, number>;
    faults_per_sim_hour: number | null;
    delays_per_sim_hour: number | null;
  };
  charging: {
    target_soc_p50: number | null;
    soc_start_p50: number | null;
    /** initial_rate_kw / max_rate_kw — the charge curve OBSERVED, not declared */
    charge_curve_ratio_p50: number | null;
    battery_temp_c_p50: number | null;
    /** null today: the twin records the key and never fills it */
    battery_soh_pct_p50: number | null;
    sessions_completed: number;
    energy_kwh_total: number | null;
    avg_power_kw_p50: number | null;
    session_duration_s_p50: number | null;
    auto_rerouted: number;
  };
  demand_forecast: TwinDemandForecast | null;
  throughput: {
    valve_holds: number;
    held_total: number | null;
    released_total: number | null;
    cap_last: number | null;
  };
  error?: string;
}

/**
 * Which depot a run actually simulates (RPC `ottoq_twin_run_context`).
 *
 * `ottoq_twin_snapshot` publishes the run block WITHOUT depot_id, so the client
 * hardcoded NASHVILLE_DEPOT for the layout while the run could belong to
 * another depot. The backend has two seeded 150-stall depots that share no
 * stall ids — a run on the wrong one yields a fully coherent description of a
 * building nobody is simulating. Resolve the depot from the run, always.
 */
export interface TwinRunContext {
  sim_run_id: string;
  depot_id: string;
  depot_name: string | null;
  scenario: string;
  status: string;
  seed: number | string | null;
  stall_count: number;
  fleet_count: number;
  /** what the run was CONFIGURED to use — a setting, not evidence */
  policy_configured: string | null;
  /**
   * What actually made the decisions, from ottoq_deploy_log (every deploy
   * decision is stamped with the policy that made it). NULL when no decision
   * was logged — an unrun policy is not a policy in force.
   */
  policy_observed: string | null;
  policy_decisions: number;
  /** more than one entry means the run switched policy mid-flight */
  policy_variants: Record<string, number> | null;
  /** false means the benchmark is broken: it ran a policy it was not configured for */
  policy_matches_config: boolean | null;
  error?: string;
}

/**
 * Realized wear and service-due state (RPC `ottoq_twin_wear_window`).
 *
 * Pairs with TwinFleetCondition: that carries the DRAWN intervals, this carries
 * the progress against them. An interval alone is inert — "PM every 8,450 km"
 * means nothing until you know the vehicle has driven 8,200.
 */
export interface TwinWearWindow {
  fleet_size: number;
  wear: {
    drive_km_p50: number | null;
    drive_hours_p50: number | null;
    soil_index_p50: number | null;
    soil_index_max: number | null;
    cabin_litter_total: number;
  };
  due: {
    pm_due_ratio_p50: number | null;
    pm_overdue: number;
    pm_due_soon: number;
    calib_due_ratio_p50: number | null;
    calib_overdue: number;
    measurable: number;
  };
  dtc: {
    open_total: number;
    vehicles_with_open: number;
    /** NULL when the fleet is clean. The raw column uses 99 for "none". */
    worst_rank: number | null;
    /** always "lower_is_worse" — the raw scale is inverted and unlabelled */
    rank_scale: string;
    rank_sentinel_note: string;
    by_rank: Record<string, number>;
  };
  attention: {
    av_id: string | null; vehicle_id: string;
    pm_due_ratio: number | null; calib_due_ratio: number | null;
    soil_index: number | null; open_dtc_count: number; worst_dtc_rank: number | null;
  }[];
  error?: string;
}

/** min / p50 / max for one condition attribute across the fleet. */
export interface TwinSpreadStat {
  n: number;
  min: number | null;
  p50: number | null;
  max: number | null;
  spread: number | null;
}

/**
 * Per-vehicle condition dealt at run boot (RPC `ottoq_twin_fleet_condition`).
 *
 * The twin has drawn all eight of these per vehicle since `ottoq_run_boot_draw`
 * shipped — seeded and reproducible, into `vehicles.config`. The snapshot's
 * fleet rows publish seven scalars and drop `config`, so every one of those
 * knobs moved a world OTTO-Q could not see.
 *
 * `lifespan = 'run'`: dealt once at boot, constant after. Fetch ONCE, not per
 * tick.
 */
export interface TwinVehicleCondition {
  vehicle_id: string;
  av_id: string | null;
  battery_soh_pct: number | null;
  consumption_scalar: number | null;
  charge_curve_scalar: number | null;
  soil_rate: number | null;
  pm_interval_km: number | null;
  calib_interval_h: number | null;
  service_speed_scalar: number | null;
  wash_cadence_cycles: number | null;
  cycles_since_wash: number | null;
  /** cycles_since_wash / wash_cadence_cycles; >= 1 means a wash is due */
  wash_due_ratio: number | null;
}

export interface TwinFleetCondition {
  fleet_size: number;
  with_condition: number;
  /**
   * TRUE only when every vehicle drew its condition for THIS run.
   * `vehicles.config` is one mutable row per vehicle, overwritten by the next
   * run's draw, so it can legitimately belong to a different run. FALSE means
   * this fleet's condition is someone else's. NULL means nothing was drawn.
   */
  drawn_for_this_run: boolean | null;
  drawn_run_ids: string[] | null;
  vehicles: TwinVehicleCondition[];
  spread: Record<string, TwinSpreadStat>;
  error?: string;
}

/**
 * What the fleet does once it LEAVES (RPC `ottoq_twin_offsite_window`).
 *
 * Every other feed is depot-scoped, so a vehicle vanished the moment it drove
 * off and reappeared at the gate. `ottoq_vehicle_dispatches` has recorded
 * 17,619 dispatches with planned vs actual duration, miles, SoC out and back,
 * and a return-reason taxonomy — and nothing read it.
 *
 * NOTE `energy_consumed_kwh` exists on that table and is NEVER written (0 of
 * 17,619 rows), so it is not published. Drive energy here is a SoC-delta proxy,
 * labelled as such.
 */
export interface TwinOffsiteWindow {
  dispatches: { total: number; completed: number; active: number };
  off_site_now: {
    count: number;
    elapsed_min_p50: number | null;
    return_eta_min_p50: number | null;
    soc_at_dispatch_p50: number | null;
  };
  duration: {
    planned_min_p50: number | null;
    actual_min_p50: number | null;
    actual_min_p90: number | null;
    /** median of per-trip differences, not the difference of medians */
    drift_min_p50: number | null;
    overran_plan: number;
    ratio_p50: number | null;
  };
  activity: {
    miles_p50: number | null;
    miles_per_trip_min_p50: number | null;
    soc_drop_pct_per_hour_p50: number | null;
    energy_basis: string;
  };
  soc: {
    at_dispatch_p50: number | null;
    at_return_p50: number | null;
    at_return_p10: number | null;
    returned_below_20: number;
  };
  arrival_jitter_min_p50: number | null;
  /** trips with ANY jitter — 2.5% fleet-wide, so the p50 alone reads as "never late" */
  arrival_jitter_delayed_n: number;
  arrival_jitter_min_max: number | null;
  /** why vehicles came back, and the duration each reason implies */
  by_return_trigger: Record<string, {
    n: number; planned_min_p50: number | null; actual_min_p50: number | null;
    drift_min_p50: number | null; soc_at_return_p50: number | null;
  }>;
  error?: string;
}

export interface TwinLaborWindow {
  window: { basis: string; sim_minutes_elapsed: number | null };
  staffing: Record<string, number>;
  knobs: {
    staffing_level: number | null; charging_staff: number | null;
    cleaning_staff: number | null; service_staff: number | null;
    deploy_staff: number | null; any_set: boolean;
  };
  lanes: {
    wash_cap: number | null; service_cap: number | null;
    deploy_cap: number | null;
    /** COMPUTED from the knob, not stamped by the sim — see charge_cap_basis */
    charge_cap: number | null;
    charge_stalls_physical: number | null;
    charge_cap_basis: string | null;
    patience_min: number | null; observed_at: string | null;
  };
  overflow: {
    events: number; vehicles_total: number; vehicles_max: number | null;
    escalated: number; per_sim_hour: number | null;
  };
  backlog: {
    started: number; completed: number; open: number;
    by_service: Record<string, { started: number; est_min_p50: number | null; requires_bay: string | null }>;
    bay_bound: number; digital: number; blocks_dispatch: number;
  };
  error?: string;
}

export interface Scenario {
  scenario_code: string; title: string; description: string;
  default_duration_hours: number; default_time_scale: number; status: string;
  fleet_overrides: Record<string, unknown>; weather_overrides: Record<string, unknown>;
  grid_overrides: Record<string, unknown>;
}

// ── Run-history ledger (mirrors ottoq_twin_run_list) ──
export interface TwinRunCounters {
  dispatches_total: number; dispatches_active: number; telemetry_packets: number;
  events_total: number; incidents_open: number; incidents_total: number;
  faults: number; charge_sessions: number;
}
export interface TwinRunSummary {
  sim_run_id: string; scenario: string; status: string;
  started_at: string | null; ended_at: string | null;
  sim_clock_start: string | null; sim_clock_current: string | null;
  tick_count: number; time_scale: number; seed: number | string; sim_minutes: number;
  /** ottoq_twin_run_list counts only the newest runs; an older run carries null. */
  counters: TwinRunCounters | null;
  /** Counters that reached the list's row guard (engine 0466): the number is a floor, not a count. */
  counters_capped?: (keyof TwinRunCounters)[] | null;
  variability: { spread_mult: number; rate_mult: number; tuned_knobs: number; notes: string | null } | null;
}

// ── The KPI board (otto-q-core 0609/0610: public.ottoq_twin_kpi_board) ──
/** One run's business KPIs, every figure from the run's own rows inside sim_clock_start..sim_clock_current.
 *  A missing figure is null, never 0. `ok:false` carries `error` (run_required | unknown_run | no_state_history). */
export interface TwinKpiBoard {
  ok: boolean;
  error?: string;
  message?: string;
  sim_run_id?: string;
  depot_id?: string;
  scenario?: string | null;
  status?: string | null;
  window?: { from: string; to: string; hours: number };
  cars?: number;
  fleet_hours?: number;
  /** Car-hours per group: on_road, leaving, returning, ready, charging_dcfc, charging_l2, in_bay, queue,
   *  between_steps, down, offline, other. A group no car was in is absent. */
  split_hours?: Record<string, number>;
  uptime?: { pct: number | null; on_road_pct: number | null; revenue_hours: number | null; revenue_hours_per_car_day: number | null };
  turnaround?: {
    arrivals: number; finished: number; still_in_depot: number;
    p50_min: number | null; p90_min: number | null; dwell_p50_min: number | null;
    served: number; first_service_p50_min: number | null; first_service_p90_min: number | null;
    open_so_far_p50_min: number | null;
  };
  flow?: { arrivals: number; departures: number; departures_per_hour: number | null; sent_back_before_leaving: number };
  departures?: {
    dispatched: number; soc_avg: number | null; soc_min: number | null; at_99_or_more: number; soc_unknown: number;
    trips_back: number; miles: number | null; kwh_used: number | null; soc_back_avg: number | null;
  };
  service?: {
    steps: number; done: number; required: number; required_done: number; required_open: number; cancelled: number;
    by_service: { svc: string; name: string; lane: string | null; done: number; total: number }[];
  };
  energy?: {
    snapshots: number; to_cars_kwh: number | null; grid_import_kwh: number | null; grid_export_kwh: number | null;
    solar_kwh: number | null; battery_out_kwh: number | null; battery_in_kwh: number | null; building_kwh: number | null;
    grid_cost_usd: number | null; grid_price_usd_kwh: number | null; solar_share_pct: number | null;
    peak_grid_kw_15min: number | null; peak_load_kw_15min: number | null;
    /** 0611: the depot tariff priced on its own demand basis (NES GSA-3: the highest full 30 minutes of grid draw),
     *  and the same readings with the battery output taken out. Absent on a board from before 0611. */
    peak_grid_kw_30min?: number | null; peak_grid_30min_from?: string | null; peak_without_battery_kw_30min?: number | null;
    demand_charge_usd_month?: number | null; demand_charge_without_battery_usd_month?: number | null;
    demand_tariff?: {
      schedule: string; utility: string; season: string; basis: string; usd_per_kw: number; block_kw: number | null;
      usd_per_kw_above_block: number; source_url: string | null; priced: boolean;
    } | null;
  };
  chargers?: {
    dcfc_stalls: number; l2_stalls: number; dcfc_busy_pct: number | null; l2_busy_pct: number | null;
    sessions_started: number; sessions_completed: number; sessions_faulted: number;
  };
  on_time?: { pct: number | null; on_time: number | null; late: number | null; stranded: number | null; with_due: number | null; p50_late_min: number | null };
  charger_wait?: { p50_min: number | null; p95_min: number | null; p95_floor_min: number | null; charged: number | null; waiting_at_end: number | null; owing: number | null; waiting_p50_so_far_min: number | null };
  basis?: Record<string, string>;
}
