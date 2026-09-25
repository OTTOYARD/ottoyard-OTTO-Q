// Line-by-line checks of the twin view-model against a REAL capture of a live
// busy_day run (fixtures/live_capture.json, see its _meta). Every expected
// number below was counted independently from the raw capture, not from this code.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/live_capture.json";
import type { DepotCardsResponse } from "../cards";
import type { TwinFleetCondition, TwinLayout, TwinSnapshot } from "../types";
import {
  allReservations,
  chargingNow,
  countByStage,
  doubleBooked,
  energyView,
  joinFleet,
  operatorsOf,
  stageOf,
  stallBoard,
} from "../model";

const cards = fx.cards as unknown as DepotCardsResponse;
const snapshot = fx.snapshot as unknown as TwinSnapshot;
const condition = fx.condition as unknown as TwinFleetCondition;
const layout = fx.layout as unknown as TwinLayout;

describe("capture is the live run the cards name", () => {
  it("cards and snapshot agree on the run", () => {
    expect(cards.contract_version).toBe("1.1");
    expect(cards.sim_run_id).toBe(fx._meta.sim_run_id);
    expect(snapshot.run.sim_run_id).toBe(cards.sim_run_id);
  });
});

describe("joinFleet", () => {
  const rows = joinFleet(cards, snapshot, condition);

  it("one row per carded vehicle, none dropped", () => {
    expect(rows.length).toBe(116);
    expect(new Set(rows.map((r) => r.id)).size).toBe(116);
  });

  it("states pass through verbatim", () => {
    const n = (s: string) => rows.filter((r) => r.state === s).length;
    expect(n("staged_awaiting_service")).toBe(40);
    expect(n("charging_l2")).toBe(28);
    expect(n("staged_for_departure")).toBe(20);
    expect(n("charging_dcfc")).toBe(10);
    expect(n("deployed")).toBe(10);
    expect(n("en_route_to_depot")).toBe(4);
    expect(n("in_service_bay")).toBe(2);
    expect(n("charge_complete_holding")).toBe(2);
  });

  it("stages group the enum like the twin does", () => {
    const c = countByStage(rows);
    expect(c.charging).toBe(38);
    expect(c.queued).toBe(40);
    expect(c.staged).toBe(22);
    expect(c.off_site).toBe(10);
    expect(c.inbound).toBe(4);
    expect(c.servicing).toBe(2);
    expect(c.unknown).toBe(0);
  });

  it("the twin's visit joins on id (23 open visits in the snapshot)", () => {
    expect(rows.filter((r) => r.visit).length).toBe(23);
    expect(rows.every((r) => r.visit !== undefined)).toBe(true);
  });

  it("twin variables join only when drawn for THIS run", () => {
    expect(condition.drawn_for_this_run).toBe(true);
    expect(rows.filter((r) => r.condition).length).toBe(116);
    const other = joinFleet(cards, snapshot, { ...condition, drawn_for_this_run: false });
    expect(other.filter((r) => r.condition).length).toBe(0);
  });

  it("last decision is present where the ledger has one (101 of 116)", () => {
    expect(rows.filter((r) => r.lastDecision).length).toBe(101);
  });

  it("no snapshot yet means visit is unknown, not 'no visit'", () => {
    const r = joinFleet(cards, null, null);
    expect(r.every((x) => x.visit === undefined)).toBe(true);
  });
});

describe("reservations", () => {
  const rows = joinFleet(cards, snapshot, condition);

  it("the depot board is every vehicle's held/active bookings (154)", () => {
    expect(allReservations(rows).length).toBe(154);
  });

  it("surfaces vehicles holding two ACTIVE bookings at once", () => {
    expect(doubleBooked(rows).map((r) => r.name).sort()).toEqual([
      "Tesla-AV-041", "Tesla-AV-043", "Tesla-AV-051", "Tesla-AV-066",
      "Waymo-AV-003", "Waymo-AV-004", "Waymo-AV-012", "Waymo-AV-032", "Zoox-AV-077",
    ]);
  });
});

describe("stallBoard", () => {
  const rows = joinFleet(cards, snapshot, condition);
  const { stalls, byType } = stallBoard(layout, snapshot, rows);
  const t = (type: string) => byType.find((b) => b.type === type)!;

  it("every layout stall appears once (158)", () => {
    expect(stalls.length).toBe(158);
  });

  it("occupancy by type matches the raw capture", () => {
    expect(t("dcfc")).toMatchObject({ total: 10, occupied: 10, reserved: 0, available: 0 });
    expect(t("l2")).toMatchObject({ total: 30, occupied: 28, reserved: 1, available: 1 });
    expect(t("staging")).toMatchObject({ total: 113, occupied: 59, reserved: 36, available: 18 });
    expect(t("service_bay")).toMatchObject({ total: 2, occupied: 2 });
    expect(t("wash_bay")).toMatchObject({ total: 3, available: 3 });
  });

  it("occupied stalls name their vehicle", () => {
    const occ = stalls.filter((s) => s.status === "occupied");
    expect(occ.filter((s) => s.vehicleName).length).toBe(occ.length);
  });
});

describe("energyView", () => {
  const e = energyView(snapshot)!;
  it("reads the twin's energy, battery and grid rows verbatim", () => {
    expect(e.gridImportKw).toBe(1264);
    expect(e.evChargingKw).toBe(1462.4);
    expect(e.buildingKw).toBe(54.6);
    expect(e.solarKw).toBe(0);
    expect(e.bessOutputKw).toBe(253);
    expect(e.peak15Kw).toBe(1297.2);
    expect(e.tariff).toBe("off_peak");
    expect(e.ratePerKwh).toBe(0.052);
    expect(e.bessState).toBe("discharging");
    expect(e.bessSocPct).toBe(78.73);
  });
  it("lag is measured against the run clock", () => {
    expect(e.lagMin).toBe(0);
  });
  it("no snapshot, no energy", () => {
    expect(energyView(null)).toBeNull();
  });
});

describe("helpers", () => {
  it("operators come from the cards, not a hardcoded list", () => {
    expect(operatorsOf(cards).map((o) => [o.name, o.count])).toEqual([
      ["Tesla Robotaxi TN", 36], ["Waymo Nashville", 46], ["Zoox Southeast", 34],
    ]);
  });
  it("charging split", () => {
    const c = chargingNow(joinFleet(cards, snapshot, condition));
    expect(c.dcfc.length).toBe(10);
    expect(c.l2.length).toBe(28);
  });
  it("an unmapped enum value is reported as unknown, never re-filed", () => {
    expect(stageOf("teleporting")).toBe("unknown");
    expect(stageOf(null)).toBe("unknown");
  });
});
