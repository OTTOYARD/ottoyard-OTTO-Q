// Energy, live from the twin: the site's power balance, the battery, the grid signal, and the
// vehicles drawing power right now. Every value is the twin's latest row; its age is shown.
import { useMemo } from "react";
import { useEventsWindow, useLiveDepot } from "@/lib/twin/hooks";
import { chargingNow, energyView, humanize, joinFleet } from "@/lib/twin/model";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, Section, SocBar, Stat, fmt } from "./ui";

export function EnergyPanel({ fleetOperatorId = null, scopeLabel }: { fleetOperatorId?: string | null; scopeLabel?: string }) {
  const { cards, snapshot, condition, runId, runStatus, simClock } = useLiveDepot(fleetOperatorId);
  const events = useEventsWindow(runId);
  const e = energyView(snapshot.data);
  const rows = useMemo(() => joinFleet(cards.data, snapshot.data, condition.data), [cards.data, snapshot.data, condition.data]);
  const ch = chargingNow(rows);
  const c = events.data?.charging;
  const rel = events.data?.reliability;

  if (cards.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={runStatus} simClock={simClock} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="site power, the battery, tariffs and charging" />
      ) : !e ? (
        <p className="text-sm text-muted-foreground">Waiting for the first twin frame…</p>
      ) : (
        <>
          <Section
            title="Site power balance"
            right={<span className="text-[11px] text-muted-foreground">{e.lagMin === null ? "age unknown" : e.lagMin <= 1 ? "current" : `${e.lagMin} sim-min old`}</span>}
          >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Grid import" value={fmt(e.gridImportKw)} unit="kW" sub={e.gridExportKw ? `export ${fmt(e.gridExportKw)} kW` : undefined} />
              <Stat label="EV charging" value={fmt(e.evChargingKw)} unit="kW" sub={`${ch.dcfc.length} DCFC · ${ch.l2.length} L2${fleetOperatorId ? " (yours)" : ""}`} />
              <Stat label="Building" value={fmt(e.buildingKw)} unit="kW" />
              <Stat label="Solar" value={fmt(e.solarKw)} unit="kW" />
              <Stat label="Battery output" value={fmt(e.bessOutputKw)} unit="kW" sub={e.bessState ? humanize(e.bessState) : undefined} />
              <Stat label="15-min peak" value={fmt(e.peak15Kw)} unit="kW" sub="billing-demand driver" />
            </div>
          </Section>

          <div className="grid gap-3 lg:grid-cols-3">
            <Section title="Battery (BESS)">
              <SocBar soc={e.bessSocPct} target={null} />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="State" value={e.bessState ? humanize(e.bessState) : "n/a"} />
                <Stat label="Power" value={fmt(e.bessPowerKw)} unit="kW" />
                <Stat label="Cell temp" value={fmt(e.bessTempC, 1)} unit="°C" />
              </div>
            </Section>
            <Section title="Tariff and grid">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Tariff period" value={e.tariff ? humanize(e.tariff) : "n/a"} />
                <Stat label="Energy rate" value={e.ratePerKwh === null ? "n/a" : `$${fmt(e.ratePerKwh, 3)}`} unit="/kWh" />
                <Stat label="Wholesale LMP" value={fmt(e.lmpUsdMwh, 1)} unit="$/MWh" />
                <Stat label="Grid carbon" value={fmt(e.carbonGPerKwh)} unit="g/kWh" />
              </div>
              <div className="mt-2 text-[11px]">
                {e.drActive ? (
                  <Chip tone="border-red-500/40 bg-red-500/10 text-red-300">Demand response ACTIVE · cap {fmt(e.drCapKw)} kW</Chip>
                ) : e.drActive === false ? (
                  <Chip>No demand-response call</Chip>
                ) : (
                  <Chip>Demand-response status not reported</Chip>
                )}
              </div>
            </Section>
            <Section title="Charging this run">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Sessions done" value={fmt(c?.sessions_completed)} />
                <Stat label="Energy delivered" value={fmt(c?.energy_kwh_total)} unit="kWh" />
                <Stat label="Median power" value={fmt(c?.avg_power_kw_p50, 1)} unit="kW" />
                <Stat label="Charger faults" value={fmt(rel?.charge_faults)} sub={rel?.charge_sessions ? `of ${fmt(rel.charge_sessions)} sessions` : undefined} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Depot-wide. Weather: {e.conditions ?? "n/a"}, {fmt(e.tempC, 1)} °C.</p>
            </Section>
          </div>

          <Section title={`Vehicles charging now${fleetOperatorId ? " (yours)" : ""}`} right={<span className="font-mono text-[11px] text-muted-foreground">{ch.dcfc.length + ch.l2.length}</span>}>
            {ch.dcfc.length + ch.l2.length === 0 ? (
              <p className="text-xs text-muted-foreground">No vehicle is drawing power.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[...ch.dcfc, ...ch.l2].map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-secondary/30 p-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-mono font-semibold">{r.name}</span>
                      <Chip>{r.state === "charging_dcfc" ? "DCFC" : "L2"}</Chip>
                    </div>
                    <div className="mb-1 font-mono text-[10px] text-muted-foreground">{r.stallCode ?? "stall n/a"}</div>
                    <SocBar soc={r.soc} target={r.targetSoc} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
