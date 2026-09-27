// OttoCommand's proactive insights, on REAL feed rows (fixtures/event_feed_capture.json: run 461c79fa's event feed at
// its end) and on hand-built depot cards for the charge line.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/event_feed_capture.json";
import type { CardVehicle } from "../cards";
import type { RunEventRow } from "../eventFeed";
import { liveInsights } from "../insights";

const rows = fx.rows as unknown as RunEventRow[];
const clock = (iso: string) => iso.slice(11, 16); // UTC HH:MM, so the test does not depend on the machine's zone
const RUN = "461c79fa-6f85-467f-b90a-92b33d40728d";

function car(id: string, name: string, state: string, soc: number | null): CardVehicle {
  return {
    vehicle_id: id, display_name: name, oem: null, model: null, operator: { id: null, name: null },
    state, soc, target_soc: null, stall: null, reservations: [], last_decision: null, card: null,
  };
}

describe("liveInsights", () => {
  it("says nothing without a live run", () => {
    expect(liveInsights({ runId: null, vehicles: [car("a", "A", "arrived_at_gate", 5)], feed: rows, pendingCrewApprovals: 3, clock })).toEqual([]);
  });

  it("says the run is quiet when nothing needs attention", () => {
    expect(liveInsights({ runId: RUN, vehicles: [], feed: [], pendingCrewApprovals: 0, clock })).toEqual([
      { key: "quiet", tone: "green", text: "Nothing needs attention on the live run." },
    ]);
  });

  it("leads with the critical incidents, then the newest problem, then the depot's two newest conditions", () => {
    const out = liveInsights({ runId: RUN, vehicles: [], feed: rows, pendingCrewApprovals: 0, clock });
    expect(out.map((i) => i.tone)).toEqual(["red", "red", "yellow", "yellow", "yellow"]);
    expect(out[0].text).toMatch(/^Waymo-AV-016: Arm emergency release/);
    expect(out[0].text).toMatch(/\(15:43\)$/);
    expect(out[1].text).toMatch(/^Engine: Tick failed · world · deadlock detected \(15:17\)$/);
    expect(out[2].text).toMatch(/^Tesla-AV-050: Arrival delayed · \+\d+ min/);
    expect(out[3].text).toMatch(/^Staging over capacity · /);
    expect(out[3].text).toMatch(/\(since \d\d:\d\d\)$/);
    expect(out[4].text).toMatch(/^Recharging below-floor vehicles · /);
    expect(new Set(out.map((i) => i.key)).size).toBe(out.length);
  });

  it("names the cars at the depot below 30% that are not on a charger, lowest first", () => {
    const vehicles = [
      car("1", "Tesla-AV-001", "staged_awaiting_service", 22),
      car("2", "Tesla-AV-002", "charging_dcfc", 10), // on a charger
      car("3", "Tesla-AV-003", "deployed", 5), // out on the road: the recall's business
      car("4", "Tesla-AV-004", "arrived_at_gate", 18),
      car("5", "Tesla-AV-005", "in_wash_bay", null), // no reading
      car("6", "Tesla-AV-006", "staged_for_departure", 29.6),
      car("7", "Tesla-AV-007", "in_service_bay", 25),
      car("8", "Tesla-AV-008", "staged_awaiting_service", 45),
    ];
    const [low] = liveInsights({ runId: RUN, vehicles, feed: [], pendingCrewApprovals: 0, clock });
    expect(low.tone).toBe("yellow");
    expect(low.text).toBe(
      "4 vehicles at the depot below 30% and not on a charger: Tesla-AV-004 18%, Tesla-AV-001 22%, Tesla-AV-007 25% and 1 more",
    );
    const reordered = liveInsights({ runId: RUN, vehicles: [...vehicles].reverse(), feed: [], pendingCrewApprovals: 0, clock });
    expect(reordered[0].key).toBe(low.key); // a dismissal holds until the set of cars changes
    const veryLow = liveInsights({ runId: RUN, vehicles: [car("9", "Zoox-AV-009", "arrived_at_gate", 14)], feed: [], pendingCrewApprovals: 0, clock });
    expect(veryLow[0]).toMatchObject({ tone: "red", text: "1 vehicle at the depot below 30% and not on a charger: Zoox-AV-009 14%" });
  });

  it("counts the approvals waiting on the crew", () => {
    expect(liveInsights({ runId: RUN, vehicles: [], feed: [], pendingCrewApprovals: 1, clock })).toEqual([
      { key: "approvals:1", tone: "blue", text: "1 approval waiting on the crew in Prime Ops" },
    ]);
    expect(liveInsights({ runId: RUN, vehicles: [], feed: [], pendingCrewApprovals: 2, clock })[0].text).toBe(
      "2 approvals waiting on the crew in Prime Ops",
    );
  });
});
