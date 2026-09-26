// A one-screen live depot summary, the default landing view in both cockpits.
// Fleet by stage, stall use, power, and OTTO-Q's latest calls, all from the same twin feeds
// as the detail tabs, so the numbers here always match the numbers there.
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useActivityFeed, useLiveDepot } from "@/lib/twin/hooks";
import { STAGE_LABEL, STAGE_ORDER, countByStage, decisionActor, doubleBooked, energyView, humanize, joinFleet, simTime, stallBoard } from "@/lib/twin/model";
import { DEFAULT_CATEGORIES, decisionCategory, describeDecision, isPlace } from "@/lib/twin/decisionText";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, DECISION_TONE, Section, Stat, STAGE_TONE, fmt } from "./ui";

export function LiveOverview({ fleetOperatorId = null, scopeLabel, onOpen }: {
  fleetOperatorId?: string | null;
  scopeLabel?: string;
  /** Optional navigation: the cockpit passes its own tab switcher. */
  onOpen?: (tab: "fleet" | "depot" | "energy" | "decisions") => void;
}) {
  const { cards, snapshot, condition, layout, runId, runStatus, simClock } = useLiveDepot(fleetOperatorId);
  const feed = useActivityFeed(runId, { limit: 30, changesOnly: true });
  const rows = useMemo(() => joinFleet(cards.data, snapshot.data, condition.data), [cards.data, snapshot.data, condition.data]);
  const counts = countByStage(rows);
  const board = useMemo(() => stallBoard(layout.data, snapshot.data, rows), [layout.data, snapshot.data, rows]);
  const e = energyView(snapshot.data);
  const doubles = doubleBooked(rows);
  const oos = rows.filter((r) => r.stage === "out_of_service");
  const ids = new Set(rows.map((r) => r.id));
  // Plan re-timings are the loudest decisions and start hidden, as in the feed and the twin.
  const decisions = (feed.data ?? [])
    .filter((d) => DEFAULT_CATEGORIES.has(decisionCategory(d.action)))
    .filter((d) => !fleetOperatorId || (d.vehicle_id && ids.has(d.vehicle_id)))
    .slice(0, 8);
  const ledger = cards.data?.reservation_ledger ?? {};
  const link = (tab: "fleet" | "depot" | "energy" | "decisions", label: string) =>
    onOpen ? <button type="button" onClick={() => onOpen(tab)} className="text-[11px] text-primary hover:underline">{label}</button> : null;

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;
  if (cards.error) return <p className="text-sm text-red-300">Could not read the twin: {String((cards.error as Error).message)}</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={runStatus} simClock={simClock} snapshot={snapshot.data} scopeLabel={scopeLabel ?? `${rows.length} vehicles`} />
      {!runId ? (
        <NoLiveRun what="the fleet, stalls, energy and OTTO-Q's decisions" />
      ) : (
        <>
          <Section title="Fleet by stage" right={link("fleet", "Open fleet")}>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ORDER.filter((s) => counts[s] > 0).map((s) => (
                <Chip key={s} tone={STAGE_TONE[s]}>{STAGE_LABEL[s]} <span className="font-mono">{counts[s]}</span></Chip>
              ))}
            </div>
            {doubles.length || oos.length ? (
              <div className="mt-3 space-y-1 text-xs">
                {oos.length ? (
                  <div className="flex items-center gap-1.5 text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {oos.length} out of service: <span className="font-mono">{oos.map((r) => r.name).join(", ")}</span>
                  </div>
                ) : null}
                {doubles.length ? (
                  <div className="flex items-center gap-1.5 text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {doubles.length} with two active stall reservations at once
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Section title="Stalls in use (whole depot)" right={link("depot", "Open depot")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {board.byType.map((t) => (
                  <Stat key={t.type} label={humanize(t.type)} value={`${t.occupied}/${t.total}`} sub={`${t.reserved} held · ${t.available} free`} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-muted-foreground">Bookings this run{fleetOperatorId ? " (yours)" : ""}:</span>
                {["active", "held", "done", "released", "superseded", "interrupted"].map((k) => (
                  <Chip key={k}>{k} <span className="font-mono">{ledger[k] ?? 0}</span></Chip>
                ))}
              </div>
            </Section>
            <Section title="Power (whole site)" right={link("energy", "Open energy")}>
              {e ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Grid import" value={fmt(e.gridImportKw)} unit="kW" />
                  <Stat label="EV charging" value={fmt(e.evChargingKw)} unit="kW" />
                  <Stat label="15-min peak" value={fmt(e.peak15Kw)} unit="kW" />
                  <Stat label="Battery" value={fmt(e.bessSocPct, 0)} unit="%" sub={e.bessState ? humanize(e.bessState) : undefined} />
                  <Stat label="Tariff" value={e.tariff ? humanize(e.tariff) : "n/a"} sub={e.ratePerKwh === null ? undefined : `$${fmt(e.ratePerKwh, 3)}/kWh`} />
                  <Stat label="Demand response" value={e.drActive === null ? "n/a" : e.drActive ? "ACTIVE" : "none"} sub={e.drActive ? `cap ${fmt(e.drCapKw)} kW` : undefined} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Waiting for the first twin frame…</p>
              )}
            </Section>
          </div>

          <Section title="OTTO-Q's latest decisions" right={link("decisions", "Open all decisions")}>
            {decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No decisions in the current window.</p>
            ) : (
              <ol className="space-y-1">
                {decisions.map((d) => {
                  const text = describeDecision(d);
                  const verb = typeof d.rationale?.verb === "string" ? d.rationale.verb : "";
                  const place = isPlace(d.target, verb) ? d.target : null;
                  return (
                    <li key={d.decision_seq} className="grid grid-cols-[64px_1fr] gap-2 text-[12px]" title={d.engine ? `engine: ${d.engine}` : undefined}>
                      <span className="font-mono text-muted-foreground">{simTime(d.occurred_at)}</span>
                      <span className="truncate">
                        <span className="font-mono font-semibold">{decisionActor(d)}</span>
                        {place ? <span className="font-mono text-sky-300"> → {place}</span> : null}{" "}
                        <span className={DECISION_TONE[text.tone]}>{text.title}</span>
                        {text.detail ? <span className="text-muted-foreground"> · {text.detail}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
