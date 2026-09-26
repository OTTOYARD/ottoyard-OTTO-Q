// What OTTO-Q plans next, from the engine's own published records: who is coming back and what was booked for
// them (ottoq_twin_appointments), and the site power plan in force (the day plan's ServiceProfile, re-published
// every tick). Nothing here is a forecast this app makes; it is the plan the engine is executing.
import { useMemo } from "react";
import { Area, Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppointments, useDepotCards, useSitePowerPlan, useSnapshot } from "@/lib/twin/hooks";
import { humanize, simTime } from "@/lib/twin/model";
import { inboundRows, planSeries, planSummary } from "@/lib/twin/plan";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, Section, Stat, fmt } from "./ui";

export function PlanPanel({ fleetOperatorId = null, scopeLabel }: { fleetOperatorId?: string | null; scopeLabel?: string }) {
  const cards = useDepotCards(fleetOperatorId);
  const runId = cards.data?.sim_run_id ?? null;
  const snapshot = useSnapshot(runId);
  const appts = useAppointments(runId);
  const plan = useSitePowerPlan(runId);

  // An owner's projection sees its own vehicles only; appointments name vehicles by display name.
  const mine = useMemo(
    () => (fleetOperatorId ? new Set((cards.data?.vehicles ?? []).map((v) => v.display_name)) : null),
    [cards.data, fleetOperatorId],
  );
  const inbound = useMemo(
    () => inboundRows(appts.data?.inbound).filter((r) => !mine || mine.has(r.av_id)),
    [appts.data, mine],
  );
  const series = useMemo(() => planSeries(plan.data), [plan.data]);
  const sum = useMemo(() => planSummary(plan.data), [plan.data]);
  const chart = useMemo(
    () => series.map((p) => ({ t: simTime(p.at), Load: p.loadKw, Grid: p.gridKw, Battery: p.bessKw, "EV allowance": p.evAllowanceKw })),
    [series],
  );

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={cards.data?.run_status ?? null} simClock={cards.data?.sim_clock ?? null} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="who is coming back, what was booked for them, and the site power plan" />
      ) : (
        <>
          <Section
            title={`Coming back${fleetOperatorId ? " (yours)" : ""}`}
            right={
              <span className="text-[11px] text-muted-foreground">
                {inbound.length} inbound
                {appts.data?.headline && !fleetOperatorId
                  ? ` · ${fmt(appts.data.headline.booked_before_arrival)} booked before arrival`
                  : ""}
              </span>
            }
          >
            {appts.isError ? (
              <p className="text-xs text-red-300">Could not read the inbound list: {String((appts.error as Error).message)}</p>
            ) : inbound.length === 0 ? (
              <p className="text-xs text-muted-foreground">No vehicle is returning right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Vehicle</th>
                      <th className="py-1.5 pr-3 font-medium">ETA</th>
                      <th className="py-1.5 pr-3 font-medium">SoC</th>
                      <th className="py-1.5 pr-3 font-medium">Why it's back</th>
                      <th className="py-1.5 pr-3 font-medium">Booked</th>
                      <th className="py-1.5 font-medium">Work waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbound.map((r) => (
                      <tr key={r.av_id} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-3 font-mono font-semibold">{r.av_id}</td>
                        <td className="py-1.5 pr-3 font-mono">{r.eta_min === null ? "n/a" : `${fmt(r.eta_min)} min`}</td>
                        <td className="py-1.5 pr-3 font-mono">{r.soc === null ? "n/a" : `${fmt(r.soc)}%`}</td>
                        <td className="py-1.5 pr-3">{r.return_trigger ? humanize(r.return_trigger) : "n/a"}</td>
                        <td className="py-1.5 pr-3">
                          {r.booked_stall_type ? (
                            <Chip tone={r.secured ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}>
                              {r.booked_stall_type.toUpperCase()} {r.secured ? "secured" : "requested"}
                            </Chip>
                          ) : (
                            <span className="text-muted-foreground">nothing yet</span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {r.workflow.length === 0 ? <span className="text-muted-foreground">none open</span> : r.workflow.map((w, i) => <Chip key={`${w}-${i}`}>{humanize(w)}</Chip>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="Site power plan"
            right={
              <span className="text-[11px] text-muted-foreground">
                {plan.data ? `${simTime(plan.data.window_start)} to ${simTime(plan.data.window_end)} CT · re-planned every tick` : ""}
              </span>
            }
          >
            {plan.isError ? (
              <p className="text-xs text-red-300">Could not read the plan: {String((plan.error as Error).message)}</p>
            ) : !plan.data || series.length === 0 ? (
              <p className="text-xs text-muted-foreground">The first plan is published on the run's first tick.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Stat label="Predicted peak" value={fmt(sum.predictedPeakKw)} unit="kW" sub={sum.peakAt ? `grid import, near ${simTime(sum.peakAt)} CT` : undefined} />
                  <Stat label="Battery plan" value={fmt(sum.bessDischargeKwh)} unit="kWh out" sub={`${fmt(sum.bessChargeKwh)} kWh in over the window`} />
                  <Stat label="Charging queue" value={fmt(sum.pendingVehicles)} unit="vehicles" sub={sum.pendingKwh !== null ? `${fmt(sum.pendingKwh)} kWh to deliver · ${fmt(sum.returning)} returning` : undefined} />
                  <Stat label="Battery mode now" value={sum.mode ? humanize(sum.mode) : "n/a"} sub={sum.reason ? humanize(sum.reason) : undefined} />
                </div>
                <div className="mt-3 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
                      <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={{ fontSize: 10 }} width={48} />
                      <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => `${fmt(Number(v))} kW`} />
                      <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.3} />
                      <Area type="monotone" dataKey="Load" stroke="#64748b" fill="#64748b" fillOpacity={0.15} isAnimationActive={false} />
                      <Bar dataKey="Battery" fill="#10b981" fillOpacity={0.6} isAnimationActive={false} />
                      <Line type="monotone" dataKey="Grid" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="EV allowance" stroke="#38bdf8" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Load is the site before the battery; Grid is what the plan intends to import; Battery above zero is discharging into the site,
                  below zero is charging; EV allowance is the power left for charging vehicles. Half-hour periods, sim time.
                </p>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
