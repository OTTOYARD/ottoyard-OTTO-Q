// OTTO-Q's decisions, live, in the same words as the twin cockpit's Decisions stream: what was decided, for which
// vehicle, where, and why, and how long the verdict held. Changes only: a verdict that stands tick after tick is one
// row, not one per tick. The wording is src/lib/twin/decisionText.ts, which is the twin's own file carried verbatim.
import { useMemo, useState } from "react";
import { useActivityFeed, useDepotCards, useSnapshot } from "@/lib/twin/hooks";
import { simTime } from "@/lib/twin/model";
import {
  CATEGORY_LABEL,
  DEFAULT_CATEGORIES,
  decisionCategory,
  describeDecision,
  holdText,
  isPlace,
  type DecisionCategory,
} from "@/lib/twin/decisionText";
import type { ActivityRow } from "@/lib/twin/cards";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { DECISION_TONE } from "./ui";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as DecisionCategory[];

function who(d: ActivityRow): string {
  if (d.action === "orchestrator_agent") return "OTTO-Q agent";
  if (d.action === "bess_dispatch") return "Site battery";
  return d.display_name ?? "OTTO-Q";
}

/** The agent's first applied directive, when it gave one: the one sentence of its reasoning worth a line. */
function agentDirective(d: ActivityRow): string | null {
  if (d.action !== "orchestrator_agent") return null;
  const applied = (d.rationale as { applied?: { text?: unknown }[] } | null)?.applied;
  const text = Array.isArray(applied) ? applied[0]?.text : null;
  return typeof text === "string" && text ? text : null;
}

export function DecisionFeed({ vehicleIds, limit = 60, scopeLabel }: { vehicleIds?: Set<string> | null; limit?: number; scopeLabel?: string }) {
  const cards = useDepotCards(null);
  const runId = cards.data?.sim_run_id ?? null;
  const snapshot = useSnapshot(runId);
  const feed = useActivityFeed(runId, { limit, changesOnly: true });
  const [shown, setShown] = useState<Set<DecisionCategory>>(() => new Set(DEFAULT_CATEGORIES));

  const rows = useMemo(
    () => (feed.data ?? []).filter((r) => !vehicleIds || (r.vehicle_id !== null && vehicleIds.has(r.vehicle_id))),
    [feed.data, vehicleIds],
  );
  const counts = useMemo(() => {
    const c: Record<DecisionCategory, number> = { agent: 0, dispatch: 0, energy: 0, plans: 0 };
    for (const r of rows) c[decisionCategory(r.action)] += 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => rows.filter((r) => shown.has(decisionCategory(r.action))), [rows, shown]);

  const toggle = (c: DecisionCategory) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={cards.data?.run_status ?? null} simClock={cards.data?.sim_clock ?? null} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="OTTO-Q's decisions" />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Newest first · {visible.length} changes · sim time, CT</span>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => {
                const on = shown.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      on ? "border-sky-500/40 bg-sky-500/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_LABEL[c]} {counts[c]}
                  </button>
                );
              })}
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              {rows.length > 0 ? "Nothing in the categories shown." : "No decisions yet in this window."}
            </p>
          ) : (
            <ol className="max-h-[560px] divide-y divide-border overflow-auto">
              {visible.map((d) => {
                const text = describeDecision(d);
                const verb = typeof d.rationale?.verb === "string" ? d.rationale.verb : "";
                const place = isPlace(d.target, verb) ? d.target : null;
                const hold = holdText(d, simTime);
                const directive = agentDirective(d);
                return (
                  <li key={d.decision_seq} className="grid grid-cols-[70px_1fr] gap-2 px-3 py-2 text-[12px]" title={d.engine ? `engine: ${d.engine}` : undefined}>
                    <span className="font-mono text-muted-foreground">{simTime(d.occurred_at)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold">{who(d)}</span>
                        {place ? <span className="font-mono text-sky-300">→ {place}</span> : null}
                        <span className={DECISION_TONE[text.tone]}>{text.title}</span>
                      </div>
                      {text.detail || hold ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{[text.detail, hold].filter(Boolean).join(" · ")}</div>
                      ) : null}
                      {directive ? <div className="mt-0.5 text-[11px] text-muted-foreground">{directive}</div> : null}
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
