// The two readiness events rule 9 added (otto-q-core 0542, 0543), worded as the twin cockpit words them.
import { describe, expect, it } from "vitest";
import { describeEvent, eventDomain } from "../eventFeed";

describe("rule 9's readiness events", () => {
  it("says a car held past the gate's limit waits for a person, and what it still needs (0542)", () => {
    const t = describeEvent("twin.deploy_gate_escalated", {
      held_min: 300, hard_cap_min: 240, reason: "must_do_work_open", remedy: "need_deploy", missing: ["perimeter_walkaround"],
    });
    expect(t.title).toBe("Held past the gate's limit · needs a person");
    expect(t.detail).toBe("missing perimeter walkaround · held 300 min");
    expect(eventDomain("twin.deploy_gate_escalated")).toBe("vehicles");
    const g = describeEvent("twin.deploy_gate_summary", { held: 3, released: 1, escalated: 2, held_past_hard_cap: 1 });
    expect(g.detail).toBe("3 held · 1 released · 2 escalated · 1 past the limit");
  });

  it("says a car staged to leave unfinished was sent back to what it needs (0543)", () => {
    const t = describeEvent("twin.departure_recheck", {
      rerouted: 3, back_to_gate: 1,
      cars: [
        { vehicle_id: "a", remedy: "need_charge", soc: 90, target_soc: 100, open: [] },
        { vehicle_id: "b", remedy: "need_charge", soc: 84, target_soc: 100, open: [] },
        { vehicle_id: "c", remedy: "need_deploy", soc: 100, target_soc: 100, open: ["exterior_wash"] },
      ],
    });
    expect(t.title).toBe("Kept from leaving unfinished");
    expect(t.detail).toBe("2 to a charger · 1 to a wash or detail bay · 1 no longer needs a charger");
    expect(eventDomain("twin.departure_recheck")).toBe("vehicles");
    const b = describeEvent("twin.departure_recheck", { rerouted: 0, cars: [], back_to_gate: 2 });
    expect(b.title).toBe("Back to the readiness gate");
    expect(b.detail).toBe("2 no longer need a charger");
  });
});
