// ============================================================================
// TwinDepotView — the live 3D depot at the top of the Overview tab: OTTO-TWIN's own scene, framed.
//
// Chase, 2026-10-02: "a direct snapshot that could be spun around of the live depot from either various corners of the
// depot or along middle section pole ... It could be blank or just show empty just as the twin UI does before a
// simulation has started. Then when a simulation has started it loads similarly and then you can see the vehicles
// moving around in action ... mirrored from the actual twin 3-D rendering."
//
// The picture is the twin's: its scene, its motion driver and its snapshots, at <twin>/view.html (contract:
// src/lib/twin/twinView.ts). This file frames it, keeps it on the same run as the rest of the tab, stops it drawing
// while it is off screen, and says in words what it shows. Kept file-for-file identical in OrchestrAV and OTTO-PULSE.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Box, ExternalLink, Maximize2 } from "lucide-react";
import {
  fromTwin, readViewMessage, runCommand, twinAppUrl, twinBase, twinViewUrl, viewCaption, visibilityCommand, type ViewState,
} from "@/lib/twin/twinView";
import { Section } from "./ui";

/** How long the frame may take to say it is ready before the tab offers the twin itself instead. */
export const READY_TIMEOUT_MS = 20_000;

/** A command to the view, addressed to the twin's origin only. */
function postTo(frame: HTMLIFrameElement | null, m: object) {
  try { frame?.contentWindow?.postMessage(m, new URL(twinBase()).origin); } catch { /* the frame went away */ }
}

export function TwinDepotView({ run, scopeNote }: {
  /** The run the rest of the tab shows (the twin link's pinned run, or the live run), or null to follow the live one. */
  run: string | null;
  /** Said under the view when the tab is scoped narrower than the picture (OrchestrAV opened as one fleet owner). */
  scopeNote?: string | null;
}) {
  // The frame's address is fixed when it mounts: a later change of run is a message to the view, not a reload.
  const [src] = useState(() => twinViewUrl({ run }));
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [ready, setReady] = useState(false);
  const [noWebgl, setNoWebgl] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [state, setState] = useState<ViewState | null>(null);
  const visible = useRef(true);
  const runRef = useRef(run);
  runRef.current = run;

  // Mount the frame as it nears the screen; then tell the view whenever it scrolls in or out, so it draws nothing
  // (and reads slowly) while nobody can see it.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (!e) return;
      if (e.isIntersecting) setNear(true);
      const now = e.intersectionRatio > 0;
      if (now !== visible.current) {
        visible.current = now;
        postTo(frame.current, visibilityCommand(now));
      }
    }, { rootMargin: "200px 0px", threshold: [0, 0.01] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // What the view says: ready, cannot draw, or what it is showing. Read only from the twin's origin and this frame.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !fromTwin(e.origin)) return;
      const m = readViewMessage(e.data);
      if (!m) return;
      if (m.type === "ready") {
        setReady(true);
        setTimedOut(false);
        postTo(frame.current, runCommand(runRef.current));
        postTo(frame.current, visibilityCommand(visible.current));
      } else if (m.type === "webgl_unavailable") {
        setNoWebgl(true);
      } else {
        setState(m.state);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keep the view on the tab's run.
  useEffect(() => { if (ready) postTo(frame.current, runCommand(run)); }, [run, ready]);

  // A frame that never says it is ready (blocked, offline, an old twin) is named, and the twin offered instead.
  useEffect(() => {
    if (!near || ready) return;
    const t = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [near, ready]);

  const fullScreen = () => {
    try { void frame.current?.requestFullscreen?.(); } catch { /* not allowed here */ }
  };
  const shown = state && (state.kind === "live" || state.kind === "ended") ? state.runId : run;
  const twinHref = twinAppUrl(shown);

  return (
    <Section
      title={<span className="inline-flex items-center gap-1.5"><Box className="h-4 w-4" aria-hidden /> Live depot · 3D</span>}
      right={
        <span className="flex items-center gap-3">
          {/* words on a wide screen; on a phone the icons alone, each still named for a screen reader */}
          <button type="button" onClick={fullScreen} className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-primary hover:underline [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:p-2" aria-label="Show the live depot full screen">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Full screen</span>
          </button>
          <a href={twinHref} target="_blank" rel="noopener noreferrer" aria-label="Open in OTTO-TWIN" className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-primary hover:underline [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:p-2">
            <span className="hidden sm:inline">Open in OTTO-TWIN</span><span className="sm:hidden">Twin</span> <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </span>
      }
    >
      <div ref={box} className="relative h-[clamp(240px,42vw,460px)] w-full overflow-hidden rounded-md border border-border bg-[#0A0B0E]">
        {near ? (
          <iframe
            ref={frame}
            src={src}
            title="Live 3D view of the twin depot, from OTTO-TWIN"
            className="absolute inset-0 h-full w-full border-0"
            allow="fullscreen"
            allowFullScreen
            // the view may run its scripts and read the twin; it may not navigate this page
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
        {!ready && !noWebgl && !timedOut ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading the live depot from OTTO-TWIN…
          </div>
        ) : null}
        {noWebgl || timedOut ? (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0A0B0E]/90 p-4 text-center text-xs text-muted-foreground">
            <span>{noWebgl ? "This browser cannot draw the 3D depot." : "The live 3D depot did not load here."}</span>
            <a href={twinHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Open it in OTTO-TWIN <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <span role="status" aria-live="polite" className="text-foreground">{viewCaption(state)}</span>
        {scopeNote ? <span className="text-muted-foreground">{scopeNote}</span> : null}
        <span className="text-muted-foreground">Drag to turn · pinch or scroll to zoom · tap a car to follow it</span>
      </div>
    </Section>
  );
}
