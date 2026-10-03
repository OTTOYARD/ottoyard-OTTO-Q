// ============================================================================
// The agent link (otto-q-core 0605). Every receipt an owner's agent gets back
// from OTTO-Q ends with
//
//   ?source=agent&run=<sim_run_id>&owner=<fleet_operator_id>&tab=fleet&command=<command_id>
//
// Opened, OrchestrAV opens as that owner, on that tab, with the command's
// receipt at the top and the cars it touched marked.
//
// Unlike a twin link it does NOT pin the run. The receipt says itself whether
// the command's run is still the live one, and a stop or reset of the twin
// lifts everything an agent set: so a link to an ended run is reported as
// ended, and the cockpit goes on showing the run that is live.
// ============================================================================
import { clearTwinLink } from "./twin/twinLink";

export const AGENT_TABS = ["overview", "fleet", "depots", "energy", "incidents", "analytics"] as const;
export type AgentTab = (typeof AGENT_TABS)[number];

export interface AgentLink {
  /** The fleet owner whose agent sent the command: OrchestrAV opens as this owner. */
  owner: string;
  /** The run the command applied to, as the receipt named it. */
  run: string | null;
  /** The command whose receipt to show. Null once the receipt is dismissed. */
  command: string | null;
  tab: AgentTab;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_KEY = "orchestrav.agentLink";
const uuidOrNull = (v: string | null) => (v && UUID.test(v) ? v.toLowerCase() : null);

export function parseAgentLink(search: string): AgentLink | null {
  const q = new URLSearchParams(search);
  if (q.get("source") !== "agent") return null;
  const owner = uuidOrNull(q.get("owner"));
  if (!owner) return null;
  const tab = q.get("tab");
  return {
    owner,
    run: uuidOrNull(q.get("run")),
    command: uuidOrNull(q.get("command")),
    tab: (AGENT_TABS as readonly string[]).includes(tab ?? "") ? (tab as AgentTab) : "fleet",
  };
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserStore = (): Store | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

let current: AgentLink | null = null;

/**
 * Read the link once, at startup. It is kept for this tab (a reload keeps the receipt until it is dismissed); a fresh
 * link in the URL replaces it. Opened from an agent's receipt, the cockpit stops following any twin run an earlier link
 * in this tab pinned: the receipt is about the live demo run, not a run the twin pointed at before.
 */
export function captureAgentLink(
  search: string = typeof location === "undefined" ? "" : location.search,
  store: Store | null = browserStore(),
): AgentLink | null {
  const fromUrl = parseAgentLink(search);
  if (fromUrl) {
    current = fromUrl;
    clearTwinLink();
    try {
      store?.setItem(STORE_KEY, JSON.stringify(fromUrl));
    } catch {
      /* the link still holds for this page */
    }
    return current;
  }
  let saved: AgentLink | null = null;
  try {
    const raw = store?.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<AgentLink>) : null;
    const owner = typeof v?.owner === "string" ? uuidOrNull(v.owner) : null;
    if (v && owner) {
      saved = {
        owner,
        run: typeof v.run === "string" ? uuidOrNull(v.run) : null,
        command: typeof v.command === "string" ? uuidOrNull(v.command) : null,
        tab: (AGENT_TABS as readonly string[]).includes(v.tab ?? "") ? (v.tab as AgentTab) : "fleet",
      };
    }
  } catch {
    saved = null;
  }
  current = saved;
  return current;
}

/** The link this tab was opened with, or null: the cockpit then behaves exactly as it always has. */
export const agentLink = (): AgentLink | null => current;

/** The receipt was read: stop showing it (the owner stays picked). */
export function dismissAgentReceipt(store: Store | null = browserStore()): void {
  if (!current) return;
  current = { ...current, command: null };
  try {
    store?.setItem(STORE_KEY, JSON.stringify(current));
  } catch {
    /* dismissed for this page */
  }
}
