// decisionNames.test.tsx — Live Decisions never puts a vendor's product on screen, in a row's words or in its hover
// text, on the real capture (lib/twin/__tests__/fixtures/live_capture.json: run 689095e2, tick 50). Rendered with
// react-dom/server: this repo tests in node, with no DOM.
//
// The feed's `engine` column is the model's id on an agent's pass ("nvidia/nemotron-3-ultra-550b-a55b -> cpsat_service",
// 9 of the capture's 60 rows). The list drew it as each row's hover text, and worded the solver by its product.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fx from "@/lib/twin/__tests__/fixtures/live_capture.json";
import type { ActivityRow } from "@/lib/twin/cards";
import { PRODUCT_NAMES } from "@/lib/twin/publicNames";

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
const state = vi.hoisted(() => ({ feed: [] as unknown[] }));

vi.mock("@/lib/twin/hooks", () => ({
  useDepotCards: () => ok(fx.cards),
  useSnapshot: () => ok(fx.snapshot),
  useActivityFeed: () => ok(state.feed),
}));

const { DecisionFeed } = await import("../DecisionFeed");

const capture = fx.feed as unknown as ActivityRow[];
const agentRow = capture.find((r) => r.action === "orchestrator_agent")!;
const unescape = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Everything a viewer can read: the page's HTML, which holds its text and every hover text. */
function page(feed: unknown[]): string {
  state.feed = feed;
  return unescape(renderToStaticMarkup(<DecisionFeed />));
}

describe("Live Decisions on the real capture", () => {
  it("names the solver by what it does and draws no product, model id or engine key", () => {
    const html = page(capture);
    expect(html).toContain("Lexicographic planner: completed → kernel");
    expect(PRODUCT_NAMES.filter((re) => re.test(html))).toEqual([]);
    expect(html).not.toMatch(/nemotron|cuopt|cp-?sat|cpsat|nvidia\/|deterministic_v1|engine:/i);
  });

  it("an agent row's hover says who proposed, and a decide-path row has no hover", () => {
    const rows = page(capture).split("<li ").slice(1);
    expect(rows.length).toBeGreaterThan(40);
    const hovers = rows.map((li) => /^[^>]*\btitle="([^"]*)"/.exec(li)?.[1]).filter(Boolean);
    expect(new Set(hovers)).toEqual(new Set(["Proposed by: Agent → Lexicographic planner"]));
    expect(hovers.length).toBe(capture.filter((r) => r.action === "orchestrator_agent").length);
  });

  it("the agent's own directive reads with a product and a file of ours in public names", () => {
    const html = page([{
      ...agentRow,
      rationale: { ...(agentRow.rationale ?? {}), applied: [{ text: "Waymo-AV-012 is owed a PM, per CLAUDE.md rule 9. CP-SAT made no offer." }] },
    }]);
    expect(html).toContain("Waymo-AV-012 is owed a PM, per rule 9. The lexicographic planner made no offer.");
    expect(html).not.toMatch(/CLAUDE|CP-SAT/);
  });

  it("a directive that names nothing reads exactly as the agent wrote it", () => {
    const said = "Hold Tesla-AV-041 at its charger until 80%.";
    expect(page([{ ...agentRow, rationale: { ...(agentRow.rationale ?? {}), applied: [{ text: said }] } }])).toContain(said);
  });
});
