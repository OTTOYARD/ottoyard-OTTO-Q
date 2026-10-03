// The agent link: the last line of every receipt an owner's agent gets from OTTO-Q (otto-q-core 0605) opens this
// cockpit as that owner, on the tab it names, with that command's receipt on top. It is not a twin link: it pins no
// run, and opening it stops following a twin run an earlier link in this tab pinned.
import { describe, expect, it } from "vitest";
import { agentLink, captureAgentLink, dismissAgentReceipt, parseAgentLink } from "../agentLink";
import { captureTwinLink, twinLink } from "../twin/twinLink";

const OWNER = "33333333-3333-3333-3333-333333333333";
const RUN = "5e5e5e5e-0000-0000-0000-000000000001";
const CMD = "3594a58e-ea8f-4fa8-99ff-43c0b9e9742c";
/** Exactly what 0605's ottoq_owner_app_link writes, after the app's own origin. */
const RECEIPT = `?source=agent&run=${RUN}&owner=${OWNER}&tab=fleet&command=${CMD}`;

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("parsing a receipt's link", () => {
  it("reads the owner, the run, the tab and the command", () => {
    expect(parseAgentLink(RECEIPT)).toEqual({ owner: OWNER, run: RUN, command: CMD, tab: "fleet" });
    expect(parseAgentLink(RECEIPT.toUpperCase().replace("SOURCE=AGENT", "source=agent").replace("OWNER=", "owner=")
      .replace("RUN=", "run=").replace("TAB=FLEET", "tab=fleet").replace("COMMAND=", "command="))?.owner).toBe(OWNER);
  });

  it("is not a link without source=agent and a well-formed owner", () => {
    expect(parseAgentLink("")).toBeNull();
    expect(parseAgentLink(`?source=twin&run=${RUN}&owner=${OWNER}`)).toBeNull();
    expect(parseAgentLink(`?source=agent&run=${RUN}`)).toBeNull();
    expect(parseAgentLink(`?source=agent&owner=Tesla`)).toBeNull();
  });

  it("drops what it cannot trust, and opens on the fleet when the tab is unknown", () => {
    expect(parseAgentLink(`?source=agent&owner=${OWNER}&run=x&command=y&tab=admin`)).toEqual({ owner: OWNER, run: null, command: null, tab: "fleet" });
    expect(parseAgentLink(`?source=agent&owner=${OWNER}&tab=energy`)?.tab).toBe("energy");
  });
});

describe("capturing it for this tab", () => {
  it("keeps the link across a reload, and a dismissed receipt stays dismissed", () => {
    const store = memoryStore();
    expect(captureAgentLink(RECEIPT, store)).toEqual({ owner: OWNER, run: RUN, command: CMD, tab: "fleet" });
    expect(captureAgentLink("", store)?.command).toBe(CMD);
    dismissAgentReceipt(store);
    expect(agentLink()).toEqual({ owner: OWNER, run: RUN, command: null, tab: "fleet" });
    expect(captureAgentLink("", store)).toEqual({ owner: OWNER, run: RUN, command: null, tab: "fleet" });
  });

  it("a tab opened without one has none, and a stored link that is not well formed is ignored", () => {
    expect(captureAgentLink("", memoryStore())).toBeNull();
    const bad = memoryStore();
    bad.setItem("orchestrav.agentLink", JSON.stringify({ owner: "not-an-id", command: CMD }));
    expect(captureAgentLink("", bad)).toBeNull();
    bad.setItem("orchestrav.agentLink", "{");
    expect(captureAgentLink("", bad)).toBeNull();
  });

  it("opened from a receipt, the cockpit stops following a twin run an earlier link pinned", () => {
    captureTwinLink(`?source=twin&run=${RUN}&owner=${OWNER}`, memoryStore());
    expect(twinLink()?.run).toBe(RUN);
    captureAgentLink(RECEIPT, memoryStore());
    expect(twinLink()).toBeNull();
    expect(agentLink()?.command).toBe(CMD);
  });
});
