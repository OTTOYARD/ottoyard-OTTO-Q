// The incidents split, on REAL feed rows (fixtures/event_feed_capture.json: run 461c79fa's event feed at its end).
// Expected rows were picked out of the capture by hand: a row is an incident when its emitter said warning or
// worse; a depot-level row the engine re-reports every tick is a standing condition; everything else is shown.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/event_feed_capture.json";
import type { RunEventRow } from "../eventFeed";
import { describeEvent } from "../eventFeed";
import { incidentGroups } from "../incidents";

const rows = fx.rows as unknown as RunEventRow[];

describe("incidentGroups on the captured feed", () => {
  const g = incidentGroups(rows);
  it("keeps every warning-or-worse row and drops the info rows", () => {
    expect(rows).toHaveLength(27);
    expect(g.attention.length + g.standing.length).toBe(21); // 27 minus 6 info rows
    for (const r of [...g.attention, ...g.standing]) expect(r.severity).not.toBe("info");
  });
  it("puts the depot's per-tick conditions under standing, newest first", () => {
    expect(g.standing.map((r) => r.event_type)).toEqual([
      "twin.staging_overflow", "twin.recharge_stranded", "twin.deploy_gate_summary", "twin.weather_anomaly",
      "ottoq.bay_reservation_replanned",
    ]);
  });
  it("keeps a vehicle's repeated refusal as an incident, not a condition", () => {
    const zoox = g.attention.find((r) => r.entity_name === "Zoox-AV-072");
    expect(zoox?.event_type).toBe("ottoq.refusal_escalated");
    expect(zoox?.standing).toBe(true);
  });
  it("lists the incidents newest first, the failed tick and the arm's emergency release among them", () => {
    expect(g.attention).toHaveLength(16);
    expect(g.attention[0].entity_name).toBe("Tesla-AV-050");
    expect(g.attention.at(-1)?.entity_name).toBe("Tesla-AV-047");
    expect(g.attention.map((r) => r.event_type)).toContain("sim_tick_failed");
    expect(g.attention.map((r) => r.event_type)).toContain("arm.emergency_release");
  });
  it("shows an owner only its own vehicles' incidents, and still the depot's conditions", () => {
    const own = incidentGroups(rows, new Set(["Waymo-AV-016", "Waymo-AV-039"]));
    expect(own.attention.map((r) => `${r.entity_name} ${r.event_type}`)).toEqual([
      "Waymo-AV-039 ottoq.visit_reopened",
      "Waymo-AV-039 ottoq.booking_interrupted",
      "Waymo-AV-039 ottoq.rebook_demanded",
      "Waymo-AV-039 ottoq.bay_eviction",
      "Waymo-AV-016 arm.emergency_release",
      "Waymo-AV-016 charge.session_faulted",
      "Waymo-AV-039 ottoq.bay_eviction_deferred",
    ]);
    expect(own.standing).toHaveLength(5);
  });
  it("words the captured incidents as the twin cockpit does", () => {
    const f = rows.find((r) => r.event_type === "charge.session_faulted") as RunEventRow;
    expect(describeEvent(f.event_type, f.payload)).toEqual({ title: "Charger fault ended the session", detail: "thermal emergency · repair 17 min · rerouted" });
    const t = rows.find((r) => r.event_type === "sim_tick_failed") as RunEventRow;
    expect(describeEvent(t.event_type, t.payload)).toEqual({ title: "Tick failed", detail: "world · deadlock detected" });
  });
  it("is empty for no feed", () => {
    expect(incidentGroups(undefined)).toEqual({ attention: [], standing: [] });
  });
});
