// ============================================================================
// What OTTO-Q plans next and how the run is scoring, read from the engine's own records.
//
//   service_profiles           otto-q-core 0442: the site's published forward schedule
//                              (the day plan's ServiceProfile). One row per run, re-published
//                              every tick, so it is always the plan in force now.
//   GET /sim_runs/:id/kpis     otto-twin-control: ottoq_kpi_five, recomputed server-side from
//                              the run's own rows (the twin cockpit's KPI tab reads the same door),
//                              and beside it charge_wait (ottoq_kpi_charge_wait, otto-q-core 0501).
//   ottoq_dial_promotion_ledger  the learning loop's record: every dial value the promoter
//                              enacted or rolled back, with the evidence cell it was decided on.
//   ottoq_twin_appointments.inbound  vehicles returning now, with ETA and the stall booked for them.
//
// Pure helpers only; the reads live in client.ts and the hooks in hooks.ts.
// ============================================================================

/** The day plan's detail block, as ottoq_bess_day_plan writes it. Every field can be absent. */
export interface DayPlanDetail {
  mode?: string;
  plan?: {
    mode?: string;
    charge_reason?: string;
    level_kw?: number;
    forecast_peak_kw?: number;
    plan_value_usd?: number;
    price_now?: number;
    reserve_now_kwh?: number;
    ev_queue?: {
      peak_kw?: number;
      chargers?: number;
      pending_n?: number;
      unplaced_n?: number;
      pending_kwh?: number;
      returning_n?: number;
    };
  };
  price?: number[];
}

/** service_profiles row for resource_kind='site_power'. Times are SIM time. */
export interface SitePowerPlan {
  sim_run_id: string;
  published_at: string;
  window_start: string;
  window_end: string;
  profile_state: string;
  periods: {
    solver?: string;
    source?: string;
    tick_minutes?: number;
    start_period_s?: number[];
    forecast_load_kw?: number[];
    grid_import_kw?: number[];
    bess_setpoint_kw?: number[];
    ev_allowance_kw?: number[];
    predicted_peak_kw?: number;
    detail?: DayPlanDetail;
  } | null;
}

export interface PlanPoint {
  /** Period start, SIM time (ISO). */
  at: string;
  /** Site load the plan forecasts before the battery (EV + building + lighting - solar), kW. */
  loadKw: number | null;
  /** Grid import the plan intends, kW. load minus battery output. */
  gridKw: number | null;
  /** Battery setpoint, kW. Positive = discharging into the site, negative = charging. */
  bessKw: number | null;
  /** Power the plan leaves for EV charging in this period, kW. */
  evAllowanceKw: number | null;
  /** Energy price in force, $/kWh. */
  price: number | null;
}

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The plan as one row per period. Periods are aligned on start_period_s (seconds after window_start); a
 * series shorter than the period list reads as null past its end rather than being shifted.
 */
export function planSeries(plan: SitePowerPlan | null | undefined): PlanPoint[] {
  const p = plan?.periods;
  const starts = p?.start_period_s;
  if (!plan || !p || !Array.isArray(starts) || starts.length === 0) return [];
  const t0 = Date.parse(plan.window_start);
  if (Number.isNaN(t0)) return [];
  const at = (a: number[] | undefined, i: number) => (Array.isArray(a) ? finite(a[i]) : null);
  return starts.map((s, i) => ({
    at: new Date(t0 + Number(s) * 1000).toISOString(),
    loadKw: at(p.forecast_load_kw, i),
    gridKw: at(p.grid_import_kw, i),
    bessKw: at(p.bess_setpoint_kw, i),
    evAllowanceKw: at(p.ev_allowance_kw, i),
    price: at(p.detail?.price, i),
  }));
}

export interface PlanSummary {
  predictedPeakKw: number | null;
  /** The period the plan expects the highest grid import in. */
  peakAt: string | null;
  /** kWh the battery is planned to discharge over the window. */
  bessDischargeKwh: number;
  /** kWh the battery is planned to absorb over the window. */
  bessChargeKwh: number;
  pendingVehicles: number | null;
  pendingKwh: number | null;
  returning: number | null;
  mode: string | null;
  reason: string | null;
}

export function planSummary(plan: SitePowerPlan | null | undefined): PlanSummary {
  const series = planSeries(plan);
  const stepH = (plan?.periods?.tick_minutes ?? 30) / 60;
  let peak: PlanPoint | null = null;
  let dis = 0;
  let chg = 0;
  for (const pt of series) {
    if (pt.gridKw !== null && (peak === null || (peak.gridKw ?? -Infinity) < pt.gridKw)) peak = pt;
    if (pt.bessKw !== null) {
      if (pt.bessKw > 0) dis += pt.bessKw * stepH;
      else chg += -pt.bessKw * stepH;
    }
  }
  const d = plan?.periods?.detail;
  const q = d?.plan?.ev_queue;
  return {
    predictedPeakKw: finite(plan?.periods?.predicted_peak_kw) ?? peak?.gridKw ?? null,
    peakAt: peak?.at ?? null,
    bessDischargeKwh: Math.round(dis),
    bessChargeKwh: Math.round(chg),
    pendingVehicles: finite(q?.pending_n),
    pendingKwh: finite(q?.pending_kwh),
    returning: finite(q?.returning_n),
    mode: d?.plan?.mode ?? d?.mode ?? null,
    reason: d?.plan?.charge_reason ?? null,
  };
}

/**
 * The wait for a charger (otto-q-core 0501, `ottoq_kpi_charge_wait`, G233), beside the five and not one of them: minutes
 * from a visit's arrival to its first charging session, over the visits that arrived owing a charge. KPI 5 counts from
 * recall to the FIRST operation, which on a busy day is a cabin or digital task that starts at once, so it cannot see
 * the charger queue. A visit still owed at the run's clock is waiting: its minutes so far are a floor, and so is
 * `p95_wait_floor_min`.
 */
export interface ChargeWait {
  sim_run_id: string;
  horizon: string | null;
  visits_owing_a_charge: number;
  charged: number;
  waiting_at_horizon: number;
  closed_without_a_session: number;
  /** Over the visits that charged. */
  p50_wait_min: number | null;
  p95_wait_min: number | null;
  max_wait_min: number | null;
  /** Over the visits still waiting, as of the run's clock. */
  waiting_p50_so_far_min: number | null;
  waiting_max_so_far_min: number | null;
  /** Over both, the waiting ones at their floor: a floor on the true p95. */
  p95_wait_floor_min: number | null;
  meaning?: string;
}

// ── The five canonical KPIs (CLAUDE.md 2.9), the same payload the twin cockpit's KPI tab reads ──
export interface KpiFive {
  sim_run_id: string;
  asset_hours_available_per_day: Record<string, number> | null;
  service_point_turns_per_point_per_day: Record<string, number> | null;
  /** Max 15-minute rolling grid import, NET of the site battery: the demand-billing reading. */
  peak_site_kw: number | null;
  /** Max 15-minute rolling site load BEFORE the battery. */
  peak_site_kw_demand: number | null;
  touch_events_per_turn: number | null;
  p95_time_to_service_min: number | null;
  p50_time_to_service_min: number | null;
  returns_unserved: number | null;
  purged: unknown;
  /** Beside the five, not one of them (otto-q-core 0501, G233). Absent from a twin-control older than 1.9.2. */
  charge_wait?: ChargeWait | null;
  run_key?: { policy_name?: string; scenario?: string; engine_hash?: string; config_hash?: string } | null;
  audit?: {
    touch_events_per_turn?: { turns?: number; touch_events?: number };
    p95_time_to_service_min?: { returns_measured?: number; dispatches_total?: number };
    service_point_turns_per_point_per_day?: { turns_completed?: number; points_with_a_turn_max_day?: number };
  };
}

/**
 * The sim day a per-day KPI should be read on: the day the sim clock is on, or the latest day before it.
 * Carried from the twin cockpit (TwinKpisTab.tsx): ottoq_kpi_five keys days by UTC date, and a booking that
 * runs past midnight UTC creates the next day's key with 0 turns while the run is still on the current day.
 */
export function latestDay(
  m: Record<string, number> | null | undefined,
  asOf?: string | null,
): { day: string; value: number } | null {
  if (!m || typeof m !== "object") return null;
  const cutoff = asOf && !Number.isNaN(Date.parse(asOf)) ? new Date(asOf).toISOString().slice(0, 10) : null;
  const days = Object.keys(m).sort().filter((d) => !cutoff || d <= cutoff);
  for (let i = days.length - 1; i >= 0; i--) {
    const v = Number(m[days[i]]);
    if (Number.isFinite(v)) return { day: days[i], value: v };
  }
  return null;
}

// ── The learning loop's record ──
const fmtWait = (v: number | null | undefined, digits = 0): string =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "n/a";

/**
 * The wait for a charger in one line, in the twin cockpit's words. On run 394e1e83 KPI 5 read 0.7 min while about 40
 * cars waited for a charger. While cars are still waiting, the headline p95 is a floor and the line says so, naming
 * how many wait and the longest wait so far.
 */
export function chargeWaitDetail(cw: ChargeWait): string {
  if (!cw.visits_owing_a_charge) return "no visit has arrived owing a charge yet";
  const charged = cw.charged ? `p50 ${fmtWait(cw.p50_wait_min, 1)} min over ${fmtWait(cw.charged)} charged` : "none charged yet";
  if (!cw.waiting_at_horizon) return `${charged} of ${fmtWait(cw.visits_owing_a_charge)} owing a charge`;
  return `at least: ${fmtWait(cw.waiting_at_horizon)} still waiting, the longest ${fmtWait(cw.waiting_max_so_far_min, 0)} min so far · ${charged}`;
}

export interface DialPromotion {
  promotion_id: number;
  /** REAL time: the promoter runs on the wall clock, not inside a run. */
  decided_at: string;
  param_key: string;
  from_value: number | null;
  to_value: number | null;
  outcome: string;
  reason: string | null;
  scenario: string | null;
  cell_runs: number | null;
  cell_seeds: number | null;
  rolled_back_of: number | null;
  experiment_id: string | null;
}

/** The dial value in force for each dial, per the ledger: its newest row wins (a rollback is a row too). */
export function dialsInForce(rows: DialPromotion[] | null | undefined): { param: string; value: number | null; since: string; via: DialPromotion }[] {
  const latest = new Map<string, DialPromotion>();
  for (const r of rows ?? []) {
    const cur = latest.get(r.param_key);
    if (!cur || r.promotion_id > cur.promotion_id) latest.set(r.param_key, r);
  }
  return [...latest.values()]
    .sort((a, b) => b.promotion_id - a.promotion_id)
    .map((r) => ({ param: r.param_key, value: finite(r.to_value), since: r.decided_at, via: r }));
}

// ── Inbound, from ottoq_twin_appointments ──
export interface InboundRow {
  av_id: string;
  soc: number | null;
  return_trigger: string | null;
  booked_stall_type: string | null;
  secured: boolean;
  eta_min: number | null;
  workflow: string[];
}

export function inboundRows(raw: Record<string, unknown>[] | null | undefined): InboundRow[] {
  return (raw ?? [])
    .map((r) => ({
      av_id: String(r.av_id ?? "?"),
      soc: finite(typeof r.soc === "string" ? Number(r.soc) : r.soc),
      return_trigger: typeof r.return_trigger === "string" ? r.return_trigger : null,
      booked_stall_type: typeof r.booked_stall_type === "string" ? r.booked_stall_type : null,
      secured: r.secured === true,
      eta_min: finite(typeof r.eta_min === "string" ? Number(r.eta_min) : r.eta_min),
      workflow: Array.isArray(r.workflow) ? r.workflow.filter((w): w is string => typeof w === "string") : [],
    }))
    .sort((a, b) => (a.eta_min ?? Infinity) - (b.eta_min ?? Infinity));
}
