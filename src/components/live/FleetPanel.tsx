// Fleet, live from the twin: every vehicle in scope, filterable by stage and owner.
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { useLiveDepot } from "@/lib/twin/hooks";
import { STAGE_LABEL, STAGE_ORDER, countByStage, doubleBooked, joinFleet, operatorsOf, type Stage } from "@/lib/twin/model";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { VehicleLiveCard } from "./VehicleLiveCard";
import { Chip, STAGE_TONE } from "./ui";

export function FleetPanel({ fleetOperatorId = null, showOperatorFilter = true, scopeLabel }: {
  fleetOperatorId?: string | null;
  showOperatorFilter?: boolean;
  scopeLabel?: string;
}) {
  const { cards, snapshot, condition, runId, runStatus, simClock } = useLiveDepot(fleetOperatorId);
  const [stage, setStage] = useState<Stage | "all">("all");
  const [op, setOp] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => joinFleet(cards.data, snapshot.data, condition.data), [cards.data, snapshot.data, condition.data]);
  const counts = useMemo(() => countByStage(rows), [rows]);
  const ops = useMemo(() => operatorsOf(cards.data), [cards.data]);
  const doubles = useMemo(() => doubleBooked(rows), [rows]);
  const shown = rows.filter(
    (r) =>
      (stage === "all" || r.stage === stage) &&
      (op === "all" || r.operatorId === op) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.stallCode ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;
  if (cards.error) return <p className="text-sm text-red-300">Could not read the fleet feed: {String((cards.error as Error).message)}</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={runStatus} simClock={simClock} snapshot={snapshot.data} scopeLabel={scopeLabel ?? `${rows.length} vehicles`} />
      {!runId ? (
        <NoLiveRun what="each vehicle, its service queue, reservations and OTTO-Q's decisions" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setStage("all")}>
              <Chip tone={stage === "all" ? "border-primary bg-primary/15 text-foreground" : undefined}>All {rows.length}</Chip>
            </button>
            {STAGE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <button type="button" key={s} onClick={() => setStage(s)}>
                <Chip tone={stage === s ? STAGE_TONE[s] + " ring-1 ring-current" : STAGE_TONE[s]}>
                  {STAGE_LABEL[s]} <span className="font-mono">{counts[s]}</span>
                </Chip>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {showOperatorFilter && ops.length > 1 ? (
                <select value={op} onChange={(e) => setOp(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-xs">
                  <option value="all">All owners</option>
                  {ops.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.count})</option>
                  ))}
                </select>
              ) : null}
              <label className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vehicle or stall" className="w-32 bg-transparent text-xs outline-none" />
              </label>
            </div>
          </div>

          {doubles.length > 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
              <span>
                <span className="font-medium">{doubles.length} vehicle{doubles.length > 1 ? "s" : ""} with two active stall reservations at once</span>
                <span className="text-muted-foreground"> (each blocks a second stall; open a card to see both): </span>
                <span className="font-mono">{doubles.map((d) => d.name).join(", ")}</span>
              </span>
            </div>
          ) : null}

          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles match.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <VehicleLiveCard key={r.id} row={r} runId={runId} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} showOperator={showOperatorFilter} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
