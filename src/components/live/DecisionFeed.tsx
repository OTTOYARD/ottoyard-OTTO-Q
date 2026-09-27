// OTTO-Q's decisions, live: what it decided, for which vehicle, with which engine, and why.
// Changes only: a verdict that simply stands tick after tick is one row, not one per tick.
import { useState } from "react";
import { useActivityFeed, useDepotCards, useSnapshot } from "@/lib/twin/hooks";
import { humanize, rationaleText, simTime } from "@/lib/twin/model";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip } from "./ui";

const OUTCOME_TONE: Record<string, string> = {
  enacted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  held: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  refused: "border-red-500/40 bg-red-500/10 text-red-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
};

export function DecisionFeed({ vehicleIds, limit = 60, scopeLabel }: { vehicleIds?: Set<string> | null; limit?: number; scopeLabel?: string }) {
  const cards = useDepotCards(null);
  const runId = cards.data?.sim_run_id ?? null;
  const snapshot = useSnapshot(runId);
  const feed = useActivityFeed(runId, { limit, changesOnly: true });
  const [action, setAction] = useState("all");

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;
  const rows = (feed.data ?? []).filter((r) => !vehicleIds || (r.vehicle_id && vehicleIds.has(r.vehicle_id)));
  const actions = [...new Set(rows.map((r) => r.action ?? "").filter(Boolean))].sort();
  const shown = rows.filter((r) => action === "all" || r.action === action);

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={cards.data?.run_status ?? null} simClock={cards.data?.sim_clock ?? null} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="OTTO-Q's decisions" />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Newest first · {shown.length} changes</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="h-7 rounded-md border border-border bg-card px-2 text-xs">
              <option value="all">All decision types</option>
              {actions.map((a) => (
                <option key={a} value={a}>{humanize(a)}</option>
              ))}
            </select>
          </div>
          {shown.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No decisions yet in this window.</p>
          ) : (
            <ol className="max-h-[560px] divide-y divide-border overflow-auto">
              {shown.map((d) => {
                const why = rationaleText(d.rationale);
                const agentText = d.action === "orchestrator_agent" ? (d.rationale as { applied?: { text?: string }[] } | null)?.applied?.[0]?.text : null;
                return (
                  <li key={d.decision_seq} className="grid grid-cols-[70px_1fr] gap-2 px-3 py-2 text-[12px]">
                    <span className="font-mono text-muted-foreground">{simTime(d.occurred_at)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold">{d.display_name ?? "OTTO-Q"}</span>
                        <span>{humanize(d.action)}</span>
                        {d.target ? <span className="font-mono text-sky-300">→ {d.target}</span> : null}
                        <Chip tone={OUTCOME_TONE[d.outcome ?? ""]}>{d.outcome}</Chip>
                        {d.held_ticks && d.held_ticks > 1 ? <Chip title="the same verdict stood for this many decide ticks">held {d.held_ticks} ticks</Chip> : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {d.engine ? <span className="font-mono">{d.engine}</span> : null}
                        {why ? <span> · {why}</span> : null}
                      </div>
                      {agentText ? <div className="mt-0.5 text-[11px] text-muted-foreground">{agentText}</div> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
