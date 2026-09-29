// The twin link (?source=twin&run=…): a cockpit opened from the twin shows that run or says why it
// cannot, and a cockpit opened any other way is untouched.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardVehicle, DepotCardsResponse } from "../cards";
import { twinApi } from "../client";
import {
  captureTwinLink,
  clearTwinLink,
  parseTwinLink,
  pinCards,
  pinMessage,
  pinStateOf,
  setTwinLinkOwner,
  shortRun,
  twinBackUrl,
  twinLink,
} from "../twinLink";

const RUN = "1ebae97a-d56a-44a6-ba1f-8fa4c4ae239e";
const OTHER = "4b0999db-a9ef-4b35-b3e2-c985d1a259f2";
const WAYMO = "22222222-2222-2222-2222-222222222222";
const TWIN_DEPOT = "11111111-1111-1111-1111-111111111111";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const vehicle = (over: Partial<CardVehicle> = {}): CardVehicle => ({
  vehicle_id: "v1",
  display_name: "WAY-001",
  oem: "Jaguar",
  model: "I-PACE",
  operator: { id: WAYMO, name: "Waymo Nashville" },
  state: "charging_dcfc",
  soc: 55,
  target_soc: 100,
  stall: { id: "s1", code: "C01", kind: "dcfc" },
  reservations: [{ booking_id: "b1" } as CardVehicle["reservations"][number]],
  last_decision: { at: null, action: "assign_stall", verb: null, outcome: "enacted", engine: null, rationale: null },
  card: { urgency: null, dispatch_due_at: null, needs: [], steps: [], current_step: null, next_step: null },
  ...over,
});

const cards = (runId: string | null): DepotCardsResponse => ({
  endpoint: "ottoq_depot_cards",
  contract_version: "1.4",
  depot_id: TWIN_DEPOT,
  fleet_operator_id: null,
  sim_run_id: runId,
  run_status: runId ? "running" : null,
  sim_clock: runId ? "2026-09-29T14:18:03Z" : null,
  vehicles: [vehicle()],
  reservation_ledger: runId ? { held: 3 } : undefined,
});

afterEach(() => {
  clearTwinLink(null);
  vi.unstubAllGlobals();
});

describe("parseTwinLink", () => {
  it("reads the run, the owner and embed from the twin's link", () => {
    expect(parseTwinLink(`?source=twin&run=${RUN.toUpperCase()}&owner=${WAYMO}&embed=1`)).toEqual({ run: RUN, owner: WAYMO, embed: true });
    expect(parseTwinLink(`?source=twin&run=${RUN}`)).toEqual({ run: RUN, owner: null, embed: false });
  });

  it("is no link at all without source=twin and a well-formed run", () => {
    expect(parseTwinLink(`?run=${RUN}`)).toBeNull();
    expect(parseTwinLink("?source=twin&run=latest")).toBeNull();
    expect(parseTwinLink("?source=twin")).toBeNull();
    expect(parseTwinLink("")).toBeNull();
  });

  it("drops a malformed owner rather than guessing one", () => {
    expect(parseTwinLink(`?source=twin&run=${RUN}&owner=waymo`)?.owner).toBeNull();
  });
});

describe("captureTwinLink", () => {
  it("keeps the link for the tab, so sign-in and in-app navigation do not lose it", () => {
    const store = memory();
    expect(captureTwinLink(`?source=twin&run=${RUN}&embed=1`, store)).toEqual({ run: RUN, owner: null, embed: true });
    // after a redirect to /auth and back, the URL has no parameters any more
    expect(captureTwinLink("", store)).toEqual({ run: RUN, owner: null, embed: true });
    expect(twinLink()?.run).toBe(RUN);
  });

  it("lets a fresh link replace the kept one", () => {
    const store = memory();
    captureTwinLink(`?source=twin&run=${RUN}`, store);
    expect(captureTwinLink(`?source=twin&run=${OTHER}`, store)?.run).toBe(OTHER);
  });

  it("changes nothing for a cockpit opened without a link", () => {
    expect(captureTwinLink("?checkout=success", memory())).toBeNull();
    expect(twinLink()).toBeNull();
  });

  it("remembers an owner picked after arriving, and forgets everything when cleared", () => {
    const store = memory();
    captureTwinLink(`?source=twin&run=${RUN}&owner=${WAYMO}`, store);
    setTwinLinkOwner(null, store);
    expect(captureTwinLink("", store)?.owner).toBeNull();
    clearTwinLink(store);
    expect(twinLink()).toBeNull();
    expect(captureTwinLink("", store)).toBeNull();
  });
});

describe("pinCards", () => {
  it("passes the cards through untouched when they describe the pinned run", () => {
    const c = cards(RUN);
    expect(pinCards(c, RUN)).toBe(c);
  });

  it("never shows another run's cars under the pinned run", () => {
    const p = pinCards(cards(OTHER), RUN);
    expect(p.sim_run_id).toBeNull();
    expect(p.run_status).toBeNull();
    expect(p.sim_clock).toBeNull();
    expect(p.reservation_ledger).toBeUndefined();
    expect(p.vehicles[0].card).toBeNull();
    expect(p.vehicles[0].reservations).toEqual([]);
    expect(p.vehicles[0].last_decision).toBeNull();
    // who the car is and whose it is stay: the owner picker still lists every owner
    expect(p.vehicles[0].operator).toEqual({ id: WAYMO, name: "Waymo Nashville" });
    expect(p.vehicles[0].display_name).toBe("WAY-001");
  });
});

describe("pinStateOf", () => {
  it("is live exactly when the depot feed names the pinned run", () => {
    expect(pinStateOf(RUN, cards(RUN), undefined, false)).toEqual({ kind: "live" });
  });

  it("waits for the feed, then for the run's own status", () => {
    expect(pinStateOf(RUN, undefined, undefined, false)).toEqual({ kind: "checking" });
    expect(pinStateOf(RUN, cards(OTHER), undefined, false)).toEqual({ kind: "checking" });
  });

  it("tells an ended run from one that never existed", () => {
    expect(pinStateOf(RUN, cards(null), { status: "completed", depot_id: TWIN_DEPOT }, false)).toEqual({ kind: "ended", status: "completed" });
    expect(pinStateOf(RUN, cards(null), { error: "sim_run not found" }, false)).toEqual({ kind: "not_found" });
  });

  it("treats a run on another depot as not found: the cockpits watch the twin depot only", () => {
    expect(pinStateOf(RUN, cards(null), { status: "running", depot_id: "99999999-9999-9999-9999-999999999999" }, false)).toEqual({ kind: "not_found" });
  });

  it("says when the pinned run is live but a newer one holds the depot feed", () => {
    expect(pinStateOf(RUN, cards(OTHER), { status: "running", depot_id: TWIN_DEPOT }, false)).toEqual({ kind: "not_newest", liveRun: OTHER });
  });

  it("does not claim 'not found' when the check itself failed", () => {
    expect(pinStateOf(RUN, cards(OTHER), undefined, true)).toEqual({ kind: "error" });
    expect(pinStateOf(RUN, cards(OTHER), { error: "canceling statement due to statement timeout" }, false)).toEqual({ kind: "error" });
  });
});

describe("words and links", () => {
  it("names the run the way the twin does, and says 'run not found'", () => {
    expect(shortRun(RUN)).toBe("1eba…");
    expect(pinMessage({ kind: "live" }, RUN)).toBe("Live from the twin · run 1eba…");
    expect(pinMessage({ kind: "not_found" }, RUN)).toBe("From the twin · run 1eba… · run not found");
    expect(pinMessage({ kind: "ended", status: "completed" }, RUN)).toMatch(/has ended \(completed\)/);
  });

  it("goes back to the twin on the same run", () => {
    expect(twinBackUrl(RUN, undefined)).toBe(`https://ottoyarddepot-sim.lovable.app/?run=${RUN}`);
    expect(twinBackUrl(RUN, "http://localhost:8080")).toBe(`http://localhost:8080/?run=${RUN}`);
  });
});

describe("twinApi.runContext", () => {
  it("asks the twin's own run-context read, by run id", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"error":"sim_run not found"}', { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(twinApi.runContext(RUN)).resolves.toEqual({ error: "sim_run not found" });
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/rest\/v1\/rpc\/ottoq_twin_run_context$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_sim_run_id: RUN });
  });
});
