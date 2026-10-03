// A fleet owner's agent requests (otto-q-core 0559/0560), on REAL output of public.ottoq_agent_requests_for_operator
// called as anon -- this cockpit's own path -- against the migration's stub engine (fixtures/agent_requests_capture.json
// says how). The read goes through the cockpit's one OTTO-Q client, ottoqRpc; no second client exists for it.
import { afterEach, describe, expect, it, vi } from "vitest";
import fx from "./fixtures/agent_requests_capture.json";
import {
  classifyRequestsError, deciderText, engineOutcome, fetchOperatorAgentRequests, isAnswered, kindLabel, realTimeCT,
  splitRequests, statusMeta, TWIN_DEPOT_ID, type AgentRequest, type OperatorAgentRequests,
} from "../agent-requests";

const WAYMO = "22222222-2222-2222-2222-222222222222";
const reply = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "application/json" } });
const waymo = fx.waymo as unknown as OperatorAgentRequests;
const zoox = fx.zoox as unknown as OperatorAgentRequests;
const tesla = fx.tesla as unknown as OperatorAgentRequests;

afterEach(() => vi.unstubAllGlobals());

describe("the read", () => {
  it("asks the engine for one owner at the twin depot, through ottoqRpc with the cockpit's anon key", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, JSON.stringify(fx.waymo)));
    vi.stubGlobal("fetch", fetch);
    const r = await fetchOperatorAgentRequests(WAYMO);
    expect(isAnswered(r)).toBe(true);
    expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/gxdrcyphqjzjsuhxuqtg\.supabase\.co\/rest\/v1\/rpc\/ottoq_agent_requests_for_operator$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_fleet_operator_id: WAYMO, p_depot_id: TWIN_DEPOT_ID, p_limit: 50 });
    expect(fetch.mock.calls[0][1].headers.apikey).toMatch(/^eyJ/);
  });

  it("is refused by the database without an owner: it never answers for every owner at once", () => {
    expect(isAnswered(fx.no_operator as never)).toBe(false);
    expect(fx.no_operator).toEqual({ ok: false, error: "fleet_operator_required", message: "Name the fleet operator whose requests to read." });
  });
});

describe("before the gateway is on", () => {
  const failing = async (status: number, body: string) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status, body)));
    try {
      await fetchOperatorAgentRequests(WAYMO);
    } catch (e) {
      return classifyRequestsError(e);
    }
    throw new Error("expected the read to fail");
  };

  it("reads 'not installed' (0559 not applied) and 'not granted to this cockpit' (0560 not applied) as such", async () => {
    await expect(failing(404, '{"code":"PGRST202","message":"Could not find the function public.ottoq_agent_requests_for_operator(p_depot_id, p_fleet_operator_id, p_limit) in the schema cache"}'))
      .resolves.toBe("not_enabled");
    await expect(failing(401, '{"code":"42501","message":"permission denied for function ottoq_agent_requests_for_operator"}'))
      .resolves.toBe("not_granted");
  });

  it("keeps any other failure an error", async () => {
    await expect(failing(500, '{"message":"canceling statement due to statement timeout"}')).resolves.toBe("error");
    expect(classifyRequestsError(new TypeError("fetch failed"))).toBe("error");
  });
});

describe("the owner's view of each ask", () => {
  it("names who decided only as the crew or the owner's team, never the person", () => {
    const decided = waymo.items.find((r) => r.decided_by) as AgentRequest;
    expect(decided.decided_by).toEqual({ kind: "crew" });
    expect(deciderText(decided)).toBe("the depot crew");
    expect(deciderText({ decided_by: { kind: "operator" } })).toBe("your team");
    expect(deciderText({ decided_by: null })).toBeNull();
  });

  it("shows the engine's real replies: a queued recall, a refusal, an approval with no door", () => {
    const applied = zoox.items[0];
    expect(statusMeta(applied)).toMatchObject({ label: "Applied by OTTO-Q", tone: "good" });
    expect(engineOutcome(applied)).toMatch(/^Recall queued \(command [0-9a-f]{8}\)\.$/);
    const refused = waymo.items.find((r) => r.status === "refused_by_engine") as AgentRequest;
    expect(engineOutcome(refused)).toBe("OTTO-Q said: Already returning or home");
    const noDoor = tesla.items[0];
    expect(noDoor.principal.name).toBe("hermes"); // another agent's ask about this owner's car is the owner's to see
    expect(statusMeta(noDoor).label).toBe("Approved · no engine door");
    expect(engineOutcome(noDoor)).toMatch(/^OTTO-Q has no door for this adjustment yet/);
  });

  it("lists open asks first, oldest first, then the decided ones", () => {
    const { open, closed } = splitRequests(waymo.items);
    expect(open.map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(open[0].created_at <= open[1].created_at).toBe(true);
    expect(closed.map((r) => r.status)).toEqual(["refused_by_engine"]);
    expect(waymo.counts).toEqual({ open: 2, total: 3 });
  });

  it("carries the database's own word on who can decide from here", () => {
    expect(waymo.can_decide).toBe(false);
    expect(waymo.decide_note).toMatch(/Until then the depot crew decides these in OTTO-PULSE/);
  });

  it("words kinds, statuses and real times plainly", () => {
    expect(kindLabel("recall_vehicle")).toBe("Recall request");
    expect(statusMeta({ status: "declined", kind: "note" }).label).toBe("Dismissed");
    expect(statusMeta({ status: "pending", kind: "adjustment" }).label).toBe("Waiting for a decision");
    expect(realTimeCT("2026-09-28T05:55:55.44182+00:00")).toBe("Sep 28, 12:55 AM CT");
    expect(realTimeCT(undefined)).toBe("--");
  });
});
