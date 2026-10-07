// ============================================================================
// The twin link. The twin simulator's "View in" switcher opens a cockpit at
//
//   ?source=twin&run=<sim_run_id>[&owner=<fleet_operator_id>][&embed=1]
//
// (ottoyarddepot-sim src/lib/cockpitLinks.ts). With those parameters the
// cockpit is PINNED to that run: every read shows that run or says why it
// cannot, never "the newest live run" in its place. Without them nothing
// changes. Kept file-for-file identical in OrchestrAV and OTTO-PULSE.
//
// Why pinning is a filter, not a new read: ottoq_depot_cards always describes
// the newest running or paused run at the depot, and every other panel keys
// off the run id it names. So the pinned run is shown exactly when it IS that
// run; otherwise the cards are reduced to the no-live-run shape the backend
// itself returns, and the banner says which case it is (ended, not found...).
// ============================================================================
import type { DepotCardsResponse } from "./cards";
import { FLAGSHIP_DEPOT_ID } from "./config";

export interface TwinLink {
  run: string;
  /** OrchestrAV only: the fleet owner to open as. PULSE shows every owner and ignores it. */
  owner: string | null;
  /** Framed beside the depot in the twin: the cockpit hides its own header. */
  embed: boolean;
}

/** ottoq_twin_run_context: the run's status and depot, or `error: 'sim_run not found'`. */
export interface TwinRunContext {
  sim_run_id?: string;
  status?: string;
  depot_id?: string;
  scenario?: string;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_KEY = "ottoq.twinLink";
// The published twin. Moved from ottoyarddepot-sim.lovable.app on 2026-10-07; the old address answers "Project not found".
const TWIN_APP_URL = "https://otto-twin.lovable.app";

export function parseTwinLink(search: string): TwinLink | null {
  const q = new URLSearchParams(search);
  if (q.get("source") !== "twin") return null;
  const run = q.get("run");
  if (!run || !UUID.test(run)) return null;
  const owner = q.get("owner");
  return {
    run: run.toLowerCase(),
    owner: owner && UUID.test(owner) ? owner.toLowerCase() : null,
    embed: q.get("embed") === "1",
  };
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserStore = (): Store | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // storage blocked: the link lasts for this page only
  }
};

let current: TwinLink | null = null;

/**
 * Read the link once, at startup, before any redirect can drop the query string (OrchestrAV
 * sends a signed-out visitor to /auth). It is kept for this tab, so it survives sign-in and a
 * reload; a fresh link in the URL replaces it. A tab opened without one has none.
 */
export function captureTwinLink(
  search: string = typeof location === "undefined" ? "" : location.search,
  store: Store | null = browserStore(),
): TwinLink | null {
  const fromUrl = parseTwinLink(search);
  if (fromUrl) {
    current = fromUrl;
    try {
      store?.setItem(STORE_KEY, JSON.stringify(fromUrl));
    } catch {
      /* the link still holds for this page */
    }
    return current;
  }
  let saved: TwinLink | null = null;
  try {
    const raw = store?.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<TwinLink>) : null;
    if (v && typeof v.run === "string" && UUID.test(v.run)) {
      saved = { run: v.run, owner: typeof v.owner === "string" && UUID.test(v.owner) ? v.owner : null, embed: v.embed === true };
    }
  } catch {
    saved = null;
  }
  current = saved;
  return current;
}

/** The link this tab was opened with, or null: the cockpit then behaves exactly as it always has. */
export const twinLink = (): TwinLink | null => current;

/** OrchestrAV: the owner picked after arriving from the twin replaces the one the link carried. */
export function setTwinLinkOwner(owner: string | null, store: Store | null = browserStore()): void {
  if (!current) return;
  current = { ...current, owner };
  try {
    store?.setItem(STORE_KEY, JSON.stringify(current));
  } catch {
    /* kept for this page */
  }
}

/** Stop following the twin's run. The caller reloads without the parameters. */
export function clearTwinLink(store: Store | null = browserStore()): void {
  current = null;
  try {
    store?.removeItem(STORE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The twin, opened on the same run (the twin adopts `?run=` on load). */
export function twinBackUrl(run: string, base: string | undefined = import.meta.env.VITE_TWIN_URL): string {
  const url = new URL((base && base.trim()) || TWIN_APP_URL);
  url.searchParams.set("run", run);
  return url.toString();
}

/** "4b09…": how the twin names a run in its own panel header; the full id goes in a tooltip. */
export const shortRun = (run: string) => `${run.slice(0, 4)}…`;

/**
 * The depot cards as the pinned run sees them. When the cards describe the pinned run they pass
 * through untouched. When they describe another run, or none, the run and every run-scoped field
 * is removed: the same shape the backend returns when no run is live, so every panel shows its
 * honest "no live run" state instead of another run's cars.
 */
export function pinCards(cards: DepotCardsResponse, run: string): DepotCardsResponse {
  if (cards.sim_run_id === run) return cards;
  return {
    ...cards,
    sim_run_id: null,
    run_status: null,
    sim_clock: null,
    reservation_ledger: undefined,
    vehicles: (cards.vehicles ?? []).map((v) => ({ ...v, card: null, reservations: [], last_decision: null })),
  };
}

export type PinState =
  | { kind: "live" }
  | { kind: "checking" }
  | { kind: "ended"; status: string }
  | { kind: "not_newest"; liveRun: string | null }
  | { kind: "not_found" }
  | { kind: "error" };

const LIVE = ["running", "paused"];

/**
 * Where the pinned run stands. `cards` is the UNPINNED depot feed; `ctx` is only needed when the
 * feed names another run (or none), to tell an ended run from one that never existed.
 */
export function pinStateOf(
  run: string,
  cards: Pick<DepotCardsResponse, "sim_run_id"> | undefined,
  ctx: TwinRunContext | undefined,
  ctxFailed: boolean,
): PinState {
  if (cards?.sim_run_id === run) return { kind: "live" };
  if (!cards) return { kind: "checking" };
  if (ctxFailed) return { kind: "error" };
  if (!ctx) return { kind: "checking" };
  if (ctx.error) return /not found/i.test(ctx.error) ? { kind: "not_found" } : { kind: "error" };
  // A run on another depot is not a twin run: the cockpits only watch the twin depot.
  if (ctx.depot_id && ctx.depot_id !== FLAGSHIP_DEPOT_ID) return { kind: "not_found" };
  if (ctx.status && LIVE.includes(ctx.status)) return { kind: "not_newest", liveRun: cards.sim_run_id ?? null };
  return { kind: "ended", status: ctx.status ?? "unknown" };
}

/** The banner's words for each state. Plain words, the run named the way the twin names it. */
export function pinMessage(state: PinState, run: string): string {
  const r = `run ${shortRun(run)}`;
  switch (state.kind) {
    case "live":
      return `Live from the twin · ${r}`;
    case "checking":
      return `From the twin · ${r} · checking the run`;
    case "ended":
      return `From the twin · ${r} has ended (${state.status}). The cockpits show live runs only.`;
    case "not_newest":
      return `From the twin · ${r} is still live, but a newer run started at the depot, and the cockpits show the newest one.`;
    case "not_found":
      return `From the twin · ${r} · run not found`;
    case "error":
      return `From the twin · ${r} · could not check the run. Retrying.`;
  }
}
