// The decision wording, tested against the real capture (run 689095e2, tick 50). decisionText.ts is the twin
// cockpit's own file carried verbatim, so these assert what an operator of THIS cockpit reads, on real rows.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/live_capture.json";
import type { ActivityRow, DepotCardsResponse } from "../cards";
import { decisionCategory, describeDecision, holdText, isPlace } from "../decisionText";
import { cardDecisionText, simTime } from "../model";

const feed = fx.feed as unknown as ActivityRow[];
const cards = fx.cards as unknown as DepotCardsResponse;

describe("every decision in the capture reads as a verdict in words", () => {
  it("never shows the engine's name, the action's name or a raw enum as the verdict", () => {
    expect(feed.length).toBe(60);
    for (const r of feed) {
      const t = describeDecision(r);
      expect(t.title, r.action ?? "").not.toMatch(/_/);
      expect(t.title).not.toBe(r.engine);
      expect(t.title.toLowerCase()).not.toBe((r.action ?? "").replace(/_/g, " "));
      expect(t.title.length).toBeGreaterThan(0);
    }
  });

  it("puts the agent's pass on one line: objective, solver, kernel", () => {
    const agent = feed.filter((r) => r.action === "orchestrator_agent");
    expect(agent.length).toBe(9);
    for (const r of agent) {
      const t = describeDecision(r);
      expect(t.title).toBe("Agent: readiness first");
      expect(t.detail).toMatch(/^CP-SAT: completed → kernel: (no action|nothing to dispose)$/);
      expect(isPlace(r.target, "")).toBe(false); // "objective: readiness_first" is a label, not a place
    }
  });

  it("names the rule behind a shield hold, and says how long it has stood", () => {
    const held = feed.find((r) => r.display_name === "Tesla-AV-063" && r.action === "redeployment");
    expect(held).toBeDefined();
    expect(describeDecision(held!)).toEqual({ title: "Deploy held", detail: "SLA.004.required_services_complete", tone: "warn" });
    expect(holdText(held!, simTime)).toBe("since 5:42 AM, still in force");
  });

  it("draws an arrow to stalls only", () => {
    const places = feed.filter((r) => isPlace(r.target, typeof r.rationale?.verb === "string" ? r.rationale.verb : ""));
    expect(places.length).toBeGreaterThan(0);
    for (const r of places) expect(r.target).toMatch(/^NASH-/);
  });

  it("files decisions the way the twin does, plan re-timings apart", () => {
    expect(decisionCategory("orchestrator_agent")).toBe("agent");
    expect(decisionCategory("bess_dispatch")).toBe("energy");
    expect(decisionCategory("itinerary_amended")).toBe("plans");
    expect(decisionCategory("task_start")).toBe("dispatch");
  });
});

describe("a vehicle card's last decision uses the same words as the feed", () => {
  it("words every card in the capture", () => {
    const withDecision = cards.vehicles.filter((v) => v.last_decision);
    expect(withDecision.length).toBe(101);
    for (const v of withDecision) {
      const t = cardDecisionText(v.last_decision!);
      expect(t.title).not.toMatch(/_/);
      expect(t.title.toLowerCase()).not.toBe((v.last_decision!.action ?? "").replace(/_/g, " "));
    }
  });

  it("reads the verb the card carries beside its rationale", () => {
    const v = cards.vehicles.find((x) => x.display_name === "Zoox-AV-084");
    expect(cardDecisionText(v!.last_decision!)).toEqual({ title: "Held by the shield", detail: null, tone: "warn" });
  });
});
