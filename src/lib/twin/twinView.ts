// ============================================================================
// The live 3D depot the Overview tab frames: the twin's own scene, served by OTTO-TWIN at /view.html.
//
// Chase, 2026-10-02: replace the cockpits' map sections with "a direct snapshot that could be spun around of the live
// depot from either various corners of the depot or along middle section pole ... blank or just show empty just as
// the twin UI does before a simulation has started ... mirrored from the actual twin 3-D rendering."
//
// This file is the cockpit's half of the contract. The twin's half is ottoyarddepot-sim src/viewer/protocol.ts
// (written up in its docs/LIVE-VIEW.md); the two are kept word for word in step, and each side's tests pin it. Pure:
// no React, no fetch. Kept file-for-file identical in OrchestrAV and OTTO-PULSE.
//
//   <twin>/view.html?run=<sim_run_id>&cam=<cam>&spin=0|1&embed=1
//
// The view posts { source: "otto-twin-view", type: "ready" | "state" | "webgl_unavailable" } to its frame. The frame
// may post { source: "otto-cockpit", type: "visibility" | "run" | "camera" } back; the view takes those only from its
// own parent on a trusted origin. Nothing in either direction is secret: the view is a read-only picture.
// ============================================================================

export const VIEW_SOURCE = "otto-twin-view";
export const COCKPIT_SOURCE = "otto-cockpit";
// The published twin. Moved from ottoyarddepot-sim.lovable.app on 2026-10-07; the old address answers "Project not found".
const TWIN_APP_URL = "https://otto-twin.lovable.app";

export const VIEW_CAMS = ["se", "sw", "ne", "nw", "pole", "top"] as const;
export type ViewCam = (typeof VIEW_CAMS)[number];

/** What the view says it is showing (its `state` message). */
export type ViewState =
  | { kind: "connecting" }
  | { kind: "no_run" }
  | { kind: "live"; runId: string; status: string; simClock: string | null; cars: number }
  | { kind: "ended"; runId: string; status: string }
  | { kind: "not_found"; runId: string }
  | { kind: "other_depot"; runId: string }
  | { kind: "offline"; runId: string | null };

export type ViewMessage =
  | { type: "ready" }
  | { type: "webgl_unavailable" }
  | { type: "state"; state: ViewState };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The twin's address: VITE_TWIN_URL when set, else the published twin. */
export function twinBase(base: string | undefined = import.meta.env.VITE_TWIN_URL): string {
  const b = (base && base.trim()) || TWIN_APP_URL;
  return b.replace(/\/+$/, "");
}

/** The view's address. A run pins it; without one it follows the live run at the twin depot. */
export function twinViewUrl(opts: { run?: string | null; cam?: ViewCam; spin?: boolean; embed?: boolean; base?: string } = {}): string {
  const url = new URL(`${twinBase(opts.base)}/view.html`);
  if (opts.run && UUID.test(opts.run)) url.searchParams.set("run", opts.run.toLowerCase());
  if (opts.cam && opts.cam !== "se") url.searchParams.set("cam", opts.cam);
  if (opts.spin === false) url.searchParams.set("spin", "0");
  if (opts.embed !== false) url.searchParams.set("embed", "1");
  return url.toString();
}

/** The full twin, opened on the same run (the twin adopts `?run=` on load). */
export function twinAppUrl(run: string | null | undefined, base?: string): string {
  const url = new URL(`${twinBase(base)}/`);
  if (run && UUID.test(run)) url.searchParams.set("run", run.toLowerCase());
  return url.toString();
}

/** Only messages from the twin's own origin are read: a message's origin is set by the browser and cannot be forged. */
export const fromTwin = (origin: string, base?: string): boolean => {
  try { return new URL(twinBase(base)).origin === origin; } catch { return false; }
};

const isRun = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** One of the view's messages, read defensively: anything not exactly the contract is dropped, never guessed at. */
export function readViewMessage(data: unknown): ViewMessage | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  if (m.source !== VIEW_SOURCE) return null;
  if (m.type === "ready" || m.type === "webgl_unavailable") return { type: m.type };
  if (m.type !== "state" || !m.state || typeof m.state !== "object") return null;
  const s = m.state as Record<string, unknown>;
  switch (s.kind) {
    case "connecting":
    case "no_run":
      return { type: "state", state: { kind: s.kind } };
    case "live":
      if (!isRun(s.runId) || typeof s.status !== "string" || typeof s.cars !== "number") return null;
      return { type: "state", state: { kind: "live", runId: s.runId, status: s.status, simClock: typeof s.simClock === "string" ? s.simClock : null, cars: s.cars } };
    case "ended":
      if (!isRun(s.runId) || typeof s.status !== "string") return null;
      return { type: "state", state: { kind: "ended", runId: s.runId, status: s.status } };
    case "not_found":
    case "other_depot":
      return isRun(s.runId) ? { type: "state", state: { kind: s.kind, runId: s.runId } } : null;
    case "offline":
      return { type: "state", state: { kind: "offline", runId: isRun(s.runId) ? s.runId : null } };
    default:
      return null;
  }
}

/** The line under the view: what it is showing, in the cockpit's words. */
export function viewCaption(s: ViewState | null): string {
  if (!s) return "Connecting to OTTO-TWIN…";
  const clock = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })} CT`;
  };
  switch (s.kind) {
    case "connecting": return "Connecting to OTTO-TWIN…";
    case "no_run": return "No simulation running · the depot is empty until one starts";
    case "live": {
      const c = clock(s.simClock);
      return `${s.status.toLowerCase() === "paused" ? "Paused" : "Live"} · ${s.cars} ${s.cars === 1 ? "car" : "cars"} on site${c ? ` · sim ${c}` : ""}`;
    }
    case "ended": return `Run ${s.runId.slice(0, 8)} has ended (${s.status}) · the depot was cleared`;
    case "not_found": return `Run ${s.runId.slice(0, 8)} was not found`;
    case "other_depot": return `Run ${s.runId.slice(0, 8)} is not a twin-depot run`;
    case "offline": return "OTTO-TWIN is not answering · retrying";
  }
}

/** The command that pins the view to a run (or, with null, sets it following the live run), sent without a reload. */
export const runCommand = (run: string | null) => ({ source: COCKPIT_SOURCE, type: "run" as const, runId: run && isRun(run) ? run.toLowerCase() : null });
export const visibilityCommand = (visible: boolean) => ({ source: COCKPIT_SOURCE, type: "visibility" as const, visible });
export const cameraCommand = (cam: ViewCam) => ({ source: COCKPIT_SOURCE, type: "camera" as const, cam });
