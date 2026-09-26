// The plan, KPI and learning-loop helpers, checked against a REAL capture (fixtures/plan_capture.json, see its
// _meta): run 461c79fa's site power plan at its last tick, the twin depot's dial promotion ledger, and the run's
// ottoq_kpi_five. Every expected number below was worked out by hand from the raw arrays, not from this code.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/plan_capture.json";
import { dialsInForce, inboundRows, latestDay, planSeries, planSummary, type DialPromotion, type KpiFive, type SitePowerPlan } from "../plan";

const plan = fx.plan as unknown as SitePowerPlan;
const promotions = fx.promotions as unknown as DialPromotion[];
const kpis = fx.kpis as unknown as KpiFive;

describe("planSeries", () => {
  const s = planSeries(plan);
  it("has one point per published period, aligned on start_period_s from window_start", () => {
    expect(s).toHaveLength(27);
    expect(s[0].at).toBe("2026-09-26T15:54:57.770Z");
    expect(s[1].at).toBe("2026-09-26T16:24:57.770Z");
    expect(s[26].at).toBe("2026-09-27T04:54:57.770Z"); // +46,800 s = 13 h
  });
  it("carries each series at its own index", () => {
    expect(s[0]).toEqual({ at: "2026-09-26T15:54:57.770Z", loadKw: 331, gridKw: 817.8, bessKw: -486.8, evAllowanceKw: 1635, price: 0.092 });
    expect(s[13]).toMatchObject({ loadKw: 628, gridKw: 0, bessKw: 628, price: 0.235 });
  });
  it("keeps the plan's own identity: grid = load - battery output, in every period", () => {
    for (const p of s) expect(p.gridKw).toBeCloseTo((p.loadKw ?? 0) - (p.bessKw ?? 0), 6);
  });
  it("reads a series shorter than the period list as null past its end, never shifted", () => {
    const short = { ...plan, periods: { ...plan.periods, bess_setpoint_kw: [1, 2] } } as SitePowerPlan;
    const t = planSeries(short);
    expect(t[1].bessKw).toBe(2);
    expect(t[2].bessKw).toBeNull();
    expect(t[26].loadKw).toBe(678);
  });
  it("returns nothing for no plan, no periods or an unparseable window", () => {
    expect(planSeries(null)).toEqual([]);
    expect(planSeries({ ...plan, periods: null })).toEqual([]);
    expect(planSeries({ ...plan, window_start: "not a time" })).toEqual([]);
  });
});

describe("planSummary", () => {
  it("summarises the captured plan", () => {
    expect(planSummary(plan)).toEqual({
      predictedPeakKw: 1041,
      peakAt: "2026-09-26T16:24:57.770Z", // 1041 kW import in period 1 is the window's highest
      bessDischargeKwh: 1861, // (628+682+695+724+244+728+20) kW x 0.5 h = 1860.5
      bessChargeKwh: 243, // 486.8 kW x 0.5 h = 243.4
      pendingVehicles: 43,
      pendingKwh: 1856.7,
      returning: 8,
      mode: "charge",
      reason: "worth_more_later",
    });
  });
  it("is all-empty for no plan", () => {
    expect(planSummary(undefined)).toMatchObject({ predictedPeakKw: null, peakAt: null, bessDischargeKwh: 0, bessChargeKwh: 0, mode: null });
  });
});

describe("latestDay on the captured KPIs", () => {
  it("reads the sim clock's own day", () => {
    expect(latestDay(kpis.asset_hours_available_per_day, "2026-09-26T15:54:57.770Z")).toEqual({ day: "2026-09-26", value: 91.37 });
    expect(latestDay(kpis.service_point_turns_per_point_per_day, "2026-09-26T15:54:57.770Z")).toEqual({ day: "2026-09-26", value: 1.81 });
  });
  it("never reads a day after the sim clock", () => {
    expect(latestDay({ "2026-09-26": 5, "2026-09-27": 0 }, "2026-09-26T23:30:00Z")).toEqual({ day: "2026-09-26", value: 5 });
    expect(latestDay(kpis.asset_hours_available_per_day, "2026-09-25T12:00:00Z")).toBeNull();
  });
});

describe("dialsInForce on the captured ledger", () => {
  it("takes each dial's newest row, so a rollback followed by a restore reads as the restore", () => {
    const d = dialsInForce(promotions);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ param: "energy_reserve_shave", value: 1, since: "2026-09-26T11:25:33.921961+00:00" });
    expect(d[0].via.promotion_id).toBe(11);
  });
  it("reads a rollback as in force when it is the newest row", () => {
    const d = dialsInForce(promotions.filter((p) => p.promotion_id !== 11));
    expect(d[0]).toMatchObject({ value: 0 });
    expect(d[0].via.outcome).toBe("rolled_back");
  });
  it("is empty for an empty ledger", () => {
    expect(dialsInForce([])).toEqual([]);
    expect(dialsInForce(undefined)).toEqual([]);
  });
});

describe("inboundRows", () => {
  // Shaped exactly as ottoq_twin_appointments builds `inbound` (jsonb_build_object keys, round() gives numbers).
  const raw = [
    { av_id: "Waymo-AV-025", soc: 41, return_trigger: "low_soc", booked_stall_type: "dcfc", secured: true, eta_min: 12, workflow: ["charge", "sensor_clean"] },
    { av_id: "Zoox-AV-007", soc: 63, return_trigger: "shift_end", booked_stall_type: null, secured: false, eta_min: 4, workflow: [] },
    { av_id: "Tesla-AV-062", soc: null, return_trigger: null, booked_stall_type: null, secured: false, eta_min: null, workflow: null },
  ];
  it("sorts by ETA with unknown ETAs last and keeps every field", () => {
    const r = inboundRows(raw);
    expect(r.map((x) => x.av_id)).toEqual(["Zoox-AV-007", "Waymo-AV-025", "Tesla-AV-062"]);
    expect(r[1]).toEqual({ av_id: "Waymo-AV-025", soc: 41, return_trigger: "low_soc", booked_stall_type: "dcfc", secured: true, eta_min: 12, workflow: ["charge", "sensor_clean"] });
    expect(r[2]).toMatchObject({ soc: null, eta_min: null, workflow: [] });
  });
  it("is empty for no list", () => {
    expect(inboundRows(undefined)).toEqual([]);
  });
});
