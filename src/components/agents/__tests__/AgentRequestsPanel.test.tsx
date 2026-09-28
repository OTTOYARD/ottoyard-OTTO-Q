// The fleet owner's "Agent requests" panel, rendered (react-dom/server: this repo tests in node, with no DOM) through
// every state the engine can answer with, on REAL output of ottoq_agent_requests_for_operator called as anon
// (../../../lib/__tests__/fixtures/agent_requests_capture.json). Read-only by design: no state offers a button.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fx from "../../../lib/__tests__/fixtures/agent_requests_capture.json";

const state: { q: Record<string, unknown>; asked: string | null } = { q: {}, asked: null };
vi.mock("@/hooks/use-agent-requests", () => ({
  useOperatorAgentRequests: (id: string | null) => {
    state.asked = id;
    return state.q;
  },
}));

import { AgentRequestsPanel } from "../AgentRequestsPanel";

const WAYMO = "22222222-2222-2222-2222-222222222222";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const render = (id: string | null) => {
  const html = renderToStaticMarkup(<AgentRequestsPanel fleetOperatorId={id} />);
  return { html, text: text(html) };
};
const failed = (problem: string, message: string) => ({ data: undefined, isLoading: false, error: Object.assign(new Error(message), { problem }) });

beforeEach(() => {
  state.q = { data: fx.waymo, isLoading: false, error: null };
  state.asked = null;
});

describe("the panel's honest states", () => {
  it("asks nothing and says why when no owner is picked", () => {
    state.q = { data: undefined, isLoading: false, error: null };
    const { text: t } = render(null);
    expect(state.asked).toBeNull();
    expect(t).toMatch(/Pick your fleet in "Viewing as"/);
    expect(t).toMatch(/never all of them at once/);
  });

  it("says agent access is built but not enabled -- whether 0550 or only 0551 is missing -- and shows nothing else", () => {
    state.q = failed("not_enabled", "OTTO-Q rpc ottoq_agent_requests_for_operator 404: PGRST202");
    let t = render(WAYMO).text;
    expect(t).toMatch(/Agent access is built but not enabled yet/);
    expect(t).toMatch(/\(otto-q-core 0550\) is not installed yet/);
    state.q = failed("not_granted", "OTTO-Q rpc ottoq_agent_requests_for_operator 401: 42501");
    t = render(WAYMO).text;
    expect(t).toMatch(/Agent access is built but not enabled yet/);
    expect(t).toMatch(/has not been given its read \(otto-q-core 0551\)/);
    expect(t).not.toMatch(/Waymo-AV/);
  });

  it("keeps a real failure an error, in its own words", () => {
    state.q = failed("error", "OTTO-Q rpc ottoq_agent_requests_for_operator 500: timeout");
    expect(render(WAYMO).text).toMatch(/Could not read agent requests: OTTO-Q rpc ottoq_agent_requests_for_operator 500: timeout/);
  });

  it("passes on the database's own refusal", () => {
    state.q = { data: fx.no_operator, isLoading: false, error: null };
    expect(render(WAYMO).text).toMatch(/Name the fleet operator whose requests to read\./);
  });

  it("says so when no agent has asked about this owner's vehicles", () => {
    state.q = { data: { ...fx.waymo, counts: { open: 0, total: 0 }, items: [] }, isLoading: false, error: null };
    expect(render(WAYMO).text).toMatch(/No agent has asked anything about Waymo Nashville's vehicles yet\./);
  });
});

describe("the owner's requests, as the engine returned them", () => {
  it("asks for the picked owner and lists every ask, open ones first", () => {
    const { html, text: t } = render(WAYMO);
    expect(state.asked).toBe(WAYMO);
    expect((html.match(/data-testid="agent-request"/g) ?? []).length).toBe(3);
    expect(t).toMatch(/Waymo Nashville · 2 open · 3 in total/);
    expect(t.indexOf("Waiting for a decision")).toBeLessThan(t.indexOf("Refused by OTTO-Q"));
    expect(t).toMatch(/Waiting for the depot crew · lapses/);
  });

  it("shows the depot's decision and OTTO-Q's reply, and never who on the crew decided", () => {
    const t = render(WAYMO).text;
    expect(t).toMatch(/Decided by the depot crew/);
    expect(t).toMatch(/OTTO-Q said: Already returning or home/);
    expect(t).not.toMatch(/Jessica/);
  });

  it("carries the database's note on who decides, and offers no button to decide from here", () => {
    const { html, text: t } = render(WAYMO);
    expect(t).toMatch(/Until then the depot crew decides these in OTTO-PULSE\./);
    expect(html).not.toMatch(/<button/);
  });

  it("reads another agent's ask about this owner's car, and a queued recall", () => {
    state.q = { data: fx.tesla, isLoading: false, error: null };
    expect(render("33333333-3333-3333-3333-333333333333").text).toMatch(/Approved · no engine door.*Adjustment from hermes/);
    state.q = { data: fx.zoox, isLoading: false, error: null };
    expect(render("44444444-4444-4444-4444-444444444444").text).toMatch(/Applied by OTTO-Q.*Recall queued \(command [0-9a-f]{8}\)\./);
  });
});
