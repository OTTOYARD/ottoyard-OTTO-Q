// How the run is scoring and what OTTO-Q has learned. Two halves that answer different questions:
//   1. THE FIVE (CLAUDE.md 2.9): ottoq_kpi_five for the live run, recomputed server-side from the run's own rows,
//      so every figure regenerates from the run ID printed beside it. The same payload and the same words as the
//      twin cockpit's KPI tab.
//   2. THE LEARNING LOOP: the dial promotion ledger. Dials move only between runs, on paired evidence, and the
//      canon must re-certify or the move is rolled back. Each row says which way it went and why.
import { useMemo } from "react";
import { useDepotCards, useDialPromotions, useKpiFive } from "@/lib/twin/hooks";
import { humanize } from "@/lib/twin/model";
import { dialsInForce, latestDay } from "@/lib/twin/plan";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, Section, fmt } from "./ui";

const realTimeCt = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CT"
    : "n/a";

function KpiRow({ n, label, value, unit, detail }: { n: number; label: string; value: string; unit?: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-xs"><span className="mr-1.5 font-mono text-muted-foreground">{n}</span>{label}</div>
        {detail ? <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</div> : null}
      </div>
      <div className="whitespace-nowrap font-mono text-sm tabular-nums">
        {value}
        {unit && value !== "n/a" ? <span className="ml-1 text-[11px] text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

/** A reason is either a code (treatment_wins_and_every_gate_passed) or a sentence written by whoever enacted it. */
function reasonText(r: string | null): string {
  if (!r) return "";
  if (/^[a-z0-9_]+$/.test(r)) return `${humanize(r)}.`;
  return r.length > 220 ? `${r.slice(0, 220)}…` : r;
}

const OUTCOME_TONE: Record<string, string> = {
  enacted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rolled_back: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function PerformancePanel({ scopeLabel }: { scopeLabel?: string }) {
  const cards = useDepotCards(null);
  const runId = cards.data?.sim_run_id ?? null;
  const simClock = cards.data?.sim_clock ?? null;
  const kpis = useKpiFive(runId);
  const promos = useDialPromotions();
  const dials = useMemo(() => dialsInForce(promos.data), [promos.data]);

  const k = kpis.data;
  const hours = latestDay(k?.asset_hours_available_per_day, simClock);
  const turns = latestDay(k?.service_point_turns_per_point_per_day, simClock);
  const a = k?.audit;
  const shaved = k && typeof k.peak_site_kw === "number" && typeof k.peak_site_kw_demand === "number" ? k.peak_site_kw_demand - k.peak_site_kw : null;

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={cards.data?.run_status ?? null} simClock={simClock} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="this run's five KPIs" />
      ) : (
        <Section title="The five KPIs · this run" right={<span className="font-mono text-[11px] text-muted-foreground" title={runId}>run {runId.slice(0, 8)}</span>}>
          {kpis.isError && !k ? (
            <p className="text-xs text-red-300">KPI read failed: {String((kpis.error as Error).message)}</p>
          ) : !k ? (
            <p className="text-xs text-muted-foreground">Computing from the run's rows…</p>
          ) : k.purged != null ? (
            <p className="text-xs text-muted-foreground">This run's rows were purged; its KPIs live in the run archive.</p>
          ) : (
            <>
              <KpiRow n={1} label="Asset-hours available" value={fmt(hours?.value, 1)} unit="h"
                detail={hours ? `vehicle-hours deployed on sim day ${hours.day}` : "no deployed hours measured yet"} />
              <KpiRow n={2} label="Turns per service point per day" value={fmt(turns?.value, 2)}
                detail={a?.service_point_turns_per_point_per_day?.turns_completed != null
                  ? `${fmt(a.service_point_turns_per_point_per_day.turns_completed)} completed turns over ${fmt(a.service_point_turns_per_point_per_day.points_with_a_turn_max_day)} points`
                  : undefined} />
              <KpiRow n={3} label="Peak grid import (15-min)" value={fmt(k.peak_site_kw)} unit="kW"
                detail={k.peak_site_kw_demand != null
                  ? `site load before the battery peaked at ${fmt(k.peak_site_kw_demand)} kW${shaved != null && shaved > 0 ? `; the battery took ${fmt(shaved)} kW off the bill` : ""}`
                  : undefined} />
              <KpiRow n={4} label="Human touches per turn" value={fmt(k.touch_events_per_turn, 3)}
                detail={a?.touch_events_per_turn?.turns != null && a.touch_events_per_turn.touch_events != null
                  ? `${fmt(a.touch_events_per_turn.touch_events)} operator touches over ${fmt(a.touch_events_per_turn.turns)} turns`
                  : undefined} />
              <KpiRow n={5} label="Time to service, p95" value={fmt(k.p95_time_to_service_min, 1)} unit="min"
                detail={`p50 ${fmt(k.p50_time_to_service_min, 1)} min · ${fmt(a?.p95_time_to_service_min?.returns_measured)} returns measured · ${fmt(k.returns_unserved)} unserved`} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Recomputed from this run's own rows every 20 seconds; every figure regenerates from the run ID.
                {k.run_key?.policy_name ? ` Policy ${k.run_key.policy_name}.` : ""}
              </p>
            </>
          )}
        </Section>
      )}

      <Section title="What OTTO-Q has learned" right={<span className="text-[11px] text-muted-foreground">dial promotion ledger · twin depot</span>}>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Dials move between runs, never inside one: the experiment runner plays paired runs on common random numbers, a value is
          enacted only when the treatment wins and every guardrail passes, and the determinism canon must re-certify it or the
          move is rolled back automatically.
        </p>
        {promos.isError ? (
          <p className="text-xs text-red-300">Could not read the ledger: {String((promos.error as Error).message)}</p>
        ) : dials.length === 0 ? (
          <p className="text-xs text-muted-foreground">No dial has been promoted yet. The shipped defaults are in force.</p>
        ) : (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {dials.map((d) => (
                <div key={d.param} className="rounded-md border border-border bg-secondary/30 p-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold">{d.param}</span>
                    <span className="font-mono">{fmt(d.value, 2)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    in force since {realTimeCt(d.since)} · {humanize(d.via.outcome)} (#{d.via.promotion_id})
                  </div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border/50">
              {(promos.data ?? []).map((p) => (
                <div key={p.promotion_id} className="py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-muted-foreground">#{p.promotion_id}</span>
                    <Chip tone={OUTCOME_TONE[p.outcome]}>{humanize(p.outcome)}</Chip>
                    <span className="font-mono">{p.param_key}</span>
                    <span className="font-mono text-muted-foreground">{fmt(p.from_value, 2)} → {fmt(p.to_value, 2)}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{realTimeCt(p.decided_at)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground" title={p.reason ?? undefined}>
                    {p.cell_runs != null ? `${fmt(p.cell_runs)} runs over ${fmt(p.cell_seeds)} seeds${p.scenario ? ` of ${p.scenario}` : ""}. ` : ""}
                    {p.rolled_back_of != null ? `Rolls back #${p.rolled_back_of}. ` : ""}
                    {reasonText(p.reason)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
