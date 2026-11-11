// The decision wording, tested against the real capture (run 689095e2, tick 50). decisionText.ts is the twin
// cockpit's own file carried verbatim, so these assert what an operator of THIS cockpit reads, on real rows.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/live_capture.json";
import type { ActivityRow, DepotCardsResponse } from "../cards";
import { decisionCategory, describeDecision, holdText, isPlace, modelErrorText } from "../decisionText";
import { cardDecisionText, decisionActor, proposedByTitle, simTime } from "../model";
import { PRODUCT_NAMES } from "../publicNames";

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
      // the solver is named by what it does, never by its product (publicNames.ts): this line read "CP-SAT: completed"
      expect(t.detail).toMatch(/^Lexicographic planner: completed → kernel: (no action|nothing to dispose)$/);
      expect(isPlace(r.target, "")).toBe(false); // "objective: readiness_first" is a label, not a place
    }
  });

  it("names the rule behind a safety hold by what it protects, and says how long it has stood", () => {
    const held = feed.find((r) => r.display_name === "Tesla-AV-063" && r.action === "redeployment");
    expect(held).toBeDefined();
    expect(describeDecision(held!)).toEqual({ title: "Deploy held", detail: "required services are done", tone: "warn" });
    expect(holdText(held!, simTime)).toBe("since 5:42 AM, still in force");
  });

  it("draws an arrow to stalls only", () => {
    const places = feed.filter((r) => isPlace(r.target, typeof r.rationale?.verb === "string" ? r.rationale.verb : ""));
    expect(places.length).toBeGreaterThan(0);
    for (const r of places) expect(r.target).toMatch(/^NASH-/);
  });

  it("names the actor: the agent and the battery are not vehicles", () => {
    const agent = feed.find((r) => r.action === "orchestrator_agent")!;
    const battery = feed.find((r) => r.action === "bess_dispatch")!;
    const car = feed.find((r) => r.action === "redeployment")!;
    expect(decisionActor(agent)).toBe("OTTO-Q agent");       // the feed names it "OTTO-Q PRIME", a vehicle row's column
    expect(decisionActor(battery)).toBe("Site battery");
    expect(decisionActor(car)).toBe(car.display_name);
  });

  it("files decisions the way the twin does, plan re-timings apart", () => {
    expect(decisionCategory("orchestrator_agent")).toBe("agent");
    expect(decisionCategory("bess_dispatch")).toBe("energy");
    expect(decisionCategory("itinerary_amended")).toBe("plans");
    expect(decisionCategory("task_start")).toBe("dispatch");
  });
});

describe("no decision in the capture names a product, in its words or in its hover text", () => {
  // The feed's `engine` column is the model's id on an agent's pass. Both cockpits drew it as the row's hover text.
  it("the capture does carry the model's id, on the 9 agent rows of 60", () => {
    const withId = feed.filter((r) => /nemotron/i.test(r.engine ?? ""));
    expect(withId.length).toBe(9);
    expect(withId[0].engine).toBe("nvidia/nemotron-3-ultra-550b-a55b -> cpsat_service");
    expect(withId.every((r) => r.action === "orchestrator_agent")).toBe(true);
  });

  it("the hover names who proposed, in public names, and is absent for the decide path's own decisions", () => {
    const titles = feed.map((r) => proposedByTitle(r));
    expect(titles.filter(Boolean).length).toBe(9);
    for (const r of feed) {
      const title = proposedByTitle(r);
      if (r.action === "orchestrator_agent") expect(title).toBe("Proposed by: Agent → Lexicographic planner");
      else expect(title, r.engine ?? "").toBeUndefined();
    }
    expect(proposedByTitle({ engine: "forward_lex" })).toBe("Proposed by: Lexicographic planner");
    expect(proposedByTitle({ engine: null })).toBeUndefined();
  });

  it("nothing a row puts on screen carries a product name, a model's id or an engine key", () => {
    for (const r of feed) {
      const t = describeDecision(r);
      const shown = [t.title, t.detail ?? "", holdText(r, simTime) ?? "", proposedByTitle(r) ?? ""].join(" | ");
      expect(PRODUCT_NAMES.some((re) => re.test(shown)), shown).toBe(false);
      expect(shown, shown).not.toMatch(/nemotron|cuopt|cp-?sat|cpsat|or-tools|nvidia\/|deterministic_v1/i);
    }
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
    expect(cardDecisionText(v!.last_decision!)).toEqual({ title: "Held by a safety check", detail: null, tone: "warn" });
  });
});

describe("the agent's model error reads as words", () => {
  it("words a rate limit and never prints a cut-off JSON body (twin run 49c45bd4)", () => {
    expect(modelErrorText('HTTP 429: {"status":429,"title":"Too Man')).toBe("model rate-limited (HTTP 429)");
    expect(modelErrorText('HTTP 503: {"error":"upstre')).toBe("HTTP 503");
    expect(modelErrorText("model timeout after 75000 ms")).toBe("model timed out after 75 s");
    expect(modelErrorText("HTTP 404: not found")).toBe("HTTP 404: not found");
    expect(modelErrorText(undefined)).toBeNull();
  });
});
