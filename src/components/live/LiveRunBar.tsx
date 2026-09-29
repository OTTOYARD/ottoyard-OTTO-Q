// The live-run strip every twin panel sits under, and the honest empty state.
import { Radio } from "lucide-react";
import type { TwinSnapshot } from "@/lib/twin/types";
import { simTime } from "@/lib/twin/model";
import { shortRun, twinLink } from "@/lib/twin/twinLink";

export function NoLiveRun({ what = "live data" }: { what?: string }) {
  // Opened from the twin, this view is pinned to the twin's run: when that run is not the live one,
  // say so (the banner above says why) rather than claim the depot is idle.
  const link = twinLink();
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
      <p className="text-sm font-medium">{link ? `The twin's run ${shortRun(link.run)} is not live` : "No live run"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {link
          ? `This view shows only the run the twin opened it on, so ${what} for any other run stays hidden.`
          : `Start a run in OTTO-TWIN to see ${what} here, live, within 5 seconds. Nothing is shown until the twin is running.`}
      </p>
    </div>
  );
}

export function LiveRunBar({
  runId,
  status,
  simClock,
  snapshot,
  scopeLabel,
}: {
  runId: string | null;
  status: string | null;
  simClock: string | null;
  snapshot?: TwinSnapshot | null;
  scopeLabel?: string;
}) {
  if (!runId) {
    const link = twinLink();
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-zinc-500" /> {link ? `The twin's run ${shortRun(link.run)} is not live` : "No live run on the depot"}
      </div>
    );
  }
  const run = snapshot?.run;
  const live = status === "running";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 font-semibold">
        <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
        <Radio className="h-3.5 w-3.5" /> {live ? "LIVE" : "PAUSED"}
      </span>
      {run?.scenario ? <span className="text-muted-foreground">scenario <span className="font-mono text-foreground">{run.scenario}</span></span> : null}
      <span className="text-muted-foreground">sim clock <span className="font-mono text-foreground">{simTime(simClock)} CT</span></span>
      {typeof run?.tick_count === "number" ? <span className="text-muted-foreground">tick <span className="font-mono text-foreground">{run.tick_count}</span></span> : null}
      {run?.speed_x ? <span className="text-muted-foreground">speed <span className="font-mono text-foreground">{run.speed_x}x</span></span> : null}
      <span className="text-muted-foreground">run <span className="font-mono text-foreground">{runId.slice(0, 8)}</span></span>
      {scopeLabel ? <span className="ml-auto text-muted-foreground">{scopeLabel}</span> : null}
    </div>
  );
}
