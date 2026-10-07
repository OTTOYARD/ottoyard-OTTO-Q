// twinView.test.ts — the cockpit's half of the live-view contract (the twin's half: ottoyarddepot-sim
// src/viewer/protocol.ts). Kept file-for-file identical in OrchestrAV and OTTO-PULSE.
import { describe, expect, it } from "vitest";
import {
  COCKPIT_SOURCE, cameraCommand, fromTwin, readViewMessage, runCommand, twinAppUrl, twinViewUrl, viewCaption, visibilityCommand,
} from "../twinView";

const RUN = "8A1E12AE-B64B-4B6E-A82D-370F6F58315C";
const run = RUN.toLowerCase();
const TWIN = "https://otto-twin.lovable.app";

describe("the view's address", () => {
  it("frames the published twin's view, embedded, following the live run by default", () => {
    expect(twinViewUrl({ base: "" })).toBe(`${TWIN}/view.html?embed=1`);
  });

  it("pins a run, and passes a camera and a still view only when asked", () => {
    expect(twinViewUrl({ run: RUN, cam: "pole", spin: false, base: "" })).toBe(`${TWIN}/view.html?run=${run}&cam=pole&spin=0&embed=1`);
    expect(twinViewUrl({ run: "not-a-run", base: "" })).toBe(`${TWIN}/view.html?embed=1`);
  });

  it("follows VITE_TWIN_URL, with or without a trailing slash", () => {
    expect(twinViewUrl({ base: "http://localhost:8080/" })).toBe("http://localhost:8080/view.html?embed=1");
    expect(twinAppUrl(RUN, "http://localhost:8080")).toBe(`http://localhost:8080/?run=${run}`);
    expect(twinAppUrl(null, "")).toBe(`${TWIN}/`);
  });

  it("reads messages only from the twin's own origin", () => {
    expect(fromTwin(TWIN, "")).toBe(true);
    expect(fromTwin("https://evil.example.com", "")).toBe(false);
    expect(fromTwin("https://otto-twin.lovable.app.evil.com", "")).toBe(false);
    expect(fromTwin("https://ottoyarddepot-sim.lovable.app", "")).toBe(false); // the old address, released 2026-10-07
    expect(fromTwin("http://localhost:8080", "http://localhost:8080/")).toBe(true);
  });
});

describe("the view's messages", () => {
  it("reads ready, cannot-draw and each state exactly", () => {
    expect(readViewMessage({ source: "otto-twin-view", type: "ready" })).toEqual({ type: "ready" });
    expect(readViewMessage({ source: "otto-twin-view", type: "webgl_unavailable" })).toEqual({ type: "webgl_unavailable" });
    expect(readViewMessage({ source: "otto-twin-view", type: "state", state: { kind: "no_run" } }))
      .toEqual({ type: "state", state: { kind: "no_run" } });
    expect(readViewMessage({ source: "otto-twin-view", type: "state", state: { kind: "live", runId: run, status: "running", simClock: "2026-10-02T19:05:00Z", cars: 41 } }))
      .toEqual({ type: "state", state: { kind: "live", runId: run, status: "running", simClock: "2026-10-02T19:05:00Z", cars: 41 } });
    expect(readViewMessage({ source: "otto-twin-view", type: "state", state: { kind: "offline", runId: null } }))
      .toEqual({ type: "state", state: { kind: "offline", runId: null } });
  });

  it("drops anything else: another sender, a malformed state, an unknown kind", () => {
    for (const m of [
      null, "ready", { type: "ready" },
      { source: "someone", type: "ready" },
      { source: "otto-twin-view", type: "state" },
      { source: "otto-twin-view", type: "state", state: { kind: "live", runId: "x", status: "running", cars: 1 } },
      { source: "otto-twin-view", type: "state", state: { kind: "live", runId: run, status: "running", cars: "many" } },
      { source: "otto-twin-view", type: "state", state: { kind: "exploded" } },
    ]) expect(readViewMessage(m)).toBeNull();
  });

  it("words what the view shows", () => {
    expect(viewCaption(null)).toBe("Connecting to OTTO-TWIN…");
    expect(viewCaption({ kind: "no_run" })).toBe("No simulation running · the depot is empty until one starts");
    expect(viewCaption({ kind: "live", runId: run, status: "running", simClock: "2026-10-02T19:05:00Z", cars: 41 })).toBe("Live · 41 cars on site · sim 2:05 PM CT");
    expect(viewCaption({ kind: "live", runId: run, status: "paused", simClock: null, cars: 1 })).toBe("Paused · 1 car on site");
    expect(viewCaption({ kind: "ended", runId: run, status: "completed" })).toBe("Run 8a1e12ae has ended (completed) · the depot was cleared");
  });

  it("sends the twin's contract back: run, visibility and camera", () => {
    expect(runCommand(RUN)).toEqual({ source: COCKPIT_SOURCE, type: "run", runId: run });
    expect(runCommand(null)).toEqual({ source: COCKPIT_SOURCE, type: "run", runId: null });
    expect(runCommand("junk")).toEqual({ source: COCKPIT_SOURCE, type: "run", runId: null });
    expect(visibilityCommand(false)).toEqual({ source: COCKPIT_SOURCE, type: "visibility", visible: false });
    expect(cameraCommand("top")).toEqual({ source: COCKPIT_SOURCE, type: "camera", cam: "top" });
  });
});
