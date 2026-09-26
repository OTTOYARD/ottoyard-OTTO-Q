// Incidents, live from the twin: what went wrong on this run and what the depot is carrying right now, from the
// run's own event feed in the twin cockpit's words. Nothing here is seeded or kept locally: no live run, nothing.
import { useMemo } from "react";
import { useDepotCards, useEventsWindow, useRunEventFeed, useSnapshot } from "@/lib/twin/hooks";
import { simTime } from "@/lib/twin/model";
import { DOMAIN_META, describeEvent, eventDomain, eventTone, repeatText } from "@/lib/twin/eventFeed";
import { incidentGroups } from "@/lib/twin/incidents";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, Section, Stat, fmt } from "./ui";

const TONE_CHIP = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  problem: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  normal: "",
} as const;

export function IncidentsPanel({ fleetOperatorId = null, scopeLabel }: { fleetOperatorId?: string | null; scopeLabel?: string }) {
  const cards = useDepotCards(fleetOperatorId);
  const runId = cards.data?.sim_run_id ?? null;
  const snapshot = useSnapshot(runId);
  const feed = useRunEventFeed(runId);
  const evWindow = useEventsWindow(runId);
  const mine = useMemo(
    () => (fleetOperatorId ? new Set((cards.data?.vehicles ?? []).map((v) => v.display_name)) : null),
    [cards.data, fleetOperatorId],
  );
  const groups = useMemo(() => incidentGroups(feed.data, mine), [feed.data, mine]);
  const rel = evWindow.data?.reliability;
  const byType = evWindow.data?.by_type ?? {};

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={cards.data?.run_status ?? null} simClock={cards.data?.sim_clock ?? null} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="charger faults, delayed arrivals, refused commands and cut-short visits" />
      ) : (
        <>
          <Section title="This run so far" right={<span className="text-[11px] text-muted-foreground">depot-wide</span>}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Charger faults" value={fmt(rel?.charge_faults)} sub={rel?.charge_sessions ? `of ${fmt(rel.charge_sessions)} sessions` : undefined} />
              <Stat label="Tows" value={fmt(rel?.tow_events)} />
              <Stat label="Arrivals delayed" value={fmt(rel?.arrival_delays)} sub={rel?.delay_min_p50 != null ? `median ${fmt(rel.delay_min_p50)} min late` : undefined} />
              <Stat label="Commands refused" value={fmt(byType["ottoq.refusal_escalated"] ?? 0)} sub="escalated after a refusal" />
              <Stat label="Visits cut short" value={fmt(byType["ottoq.booking_interrupted"] ?? 0)} />
              <Stat label="Failed ticks" value={fmt(byType["sim_tick_failed"] ?? 0)} sub="the engine's own" />
            </div>
          </Section>

          <Section
            title={`Needs attention${fleetOperatorId ? " (your vehicles)" : ""}`}
            right={<span className="font-mono text-[11px] text-muted-foreground">{groups.attention.length}</span>}
          >
            {feed.isError ? (
              <p className="text-xs text-red-300">Could not read the event feed: {String((feed.error as Error).message)}</p>
            ) : groups.attention.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing has gone wrong{fleetOperatorId ? " with your vehicles" : ""} in the feed's window.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {groups.attention.map((r) => {
                  const t = describeEvent(r.event_type, r.payload);
                  const tone = eventTone(r.severity);
                  const rep = repeatText(r, simTime);
                  return (
                    <div key={r.row_key} className="flex items-start gap-3 py-2 text-xs">
                      <span className="w-16 shrink-0 font-mono text-muted-foreground">{simTime(r.sim_at)}</span>
                      <Chip tone={TONE_CHIP[tone]}>{tone === "critical" ? "critical" : "warning"}</Chip>
                      <div className="min-w-0 flex-1">
                        <div>
                          <span className="font-medium">{t.title}</span>
                          {r.entity_name ? <span className="ml-2 font-mono text-muted-foreground">{r.entity_name}</span> : null}
                          <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: DOMAIN_META[eventDomain(r.event_type)].color }}>
                            {DOMAIN_META[eventDomain(r.event_type)].label}
                          </span>
                        </div>
                        {t.detail || rep ? <div className="text-muted-foreground">{[t.detail, rep].filter(Boolean).join(" · ")}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Depot conditions" right={<span className="text-[11px] text-muted-foreground">re-reported every tick while they hold</span>}>
            {groups.standing.length === 0 ? (
              <p className="text-xs text-muted-foreground">No standing condition.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {groups.standing.map((r) => {
                  const t = describeEvent(r.event_type, r.payload);
                  return (
                    <div key={r.row_key} className="flex items-start gap-3 py-2 text-xs">
                      <Chip tone={TONE_CHIP[eventTone(r.severity)]}>{repeatText(r, simTime) ?? "now"}</Chip>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{t.title}</span>
                        {t.detail ? <span className="ml-2 text-muted-foreground">{t.detail}</span> : null}
                      </div>
                      <span className="shrink-0 font-mono text-muted-foreground">last {simTime(r.sim_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
