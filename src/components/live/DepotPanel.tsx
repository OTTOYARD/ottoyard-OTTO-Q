// Depot, live from the twin: every stall with who is in it or held for it, and the reservation
// board OTTO-Q is working to, with its own reason for each booking.
import { useMemo, useState } from "react";
import { useLiveDepot } from "@/lib/twin/hooks";
import { allReservations, humanize, joinFleet, reservationsByPurpose, simTime, stallBoard, type StallRow } from "@/lib/twin/model";
import { LiveRunBar, NoLiveRun } from "./LiveRunBar";
import { Chip, Section, Stat } from "./ui";

const TYPE_LABEL: Record<string, string> = {
  dcfc: "DC fast chargers",
  l2: "Level 2 chargers",
  staging: "Staging",
  service_bay: "Service bays",
  wash_bay: "Wash bays",
};
const STATUS_TONE: Record<StallRow["status"], string> = {
  occupied: "border-emerald-500/40 bg-emerald-500/15",
  reserved: "border-amber-500/40 bg-amber-500/10",
  available: "border-border bg-secondary/30",
};

export function DepotPanel({ fleetOperatorId = null, scopeLabel }: { fleetOperatorId?: string | null; scopeLabel?: string }) {
  const { cards, snapshot, condition, layout, runId, runStatus, simClock } = useLiveDepot(fleetOperatorId);
  const [type, setType] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>("all");

  const rows = useMemo(() => joinFleet(cards.data, snapshot.data, condition.data), [cards.data, snapshot.data, condition.data]);
  // Stall occupancy is the WHOLE depot's, whichever owner is viewing: names are shown only for vehicles in scope.
  const board = useMemo(() => stallBoard(layout.data, snapshot.data, rows), [layout.data, snapshot.data, rows]);
  const res = useMemo(() => allReservations(rows), [rows]);
  const byPurpose = useMemo(() => reservationsByPurpose(res), [res]);
  const ledger = cards.data?.reservation_ledger ?? {};
  const activeType = type ?? board.byType[0]?.type ?? null;

  if (cards.isLoading || layout.isLoading) return <p className="text-sm text-muted-foreground">Connecting to the twin…</p>;
  if (cards.error) return <p className="text-sm text-red-300">Could not read the depot feed: {String((cards.error as Error).message)}</p>;

  return (
    <div className="space-y-3">
      <LiveRunBar runId={runId} status={runStatus} simClock={simClock} snapshot={snapshot.data} scopeLabel={scopeLabel} />
      {!runId ? (
        <NoLiveRun what="stall occupancy and reservations" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {board.byType.map((t) => (
              <button key={t.type} type="button" onClick={() => setType(t.type)} className={`text-left ${activeType === t.type ? "ring-1 ring-primary rounded-md" : ""}`}>
                <Stat
                  label={TYPE_LABEL[t.type] ?? humanize(t.type)}
                  value={`${t.occupied}/${t.total}`}
                  unit="in use"
                  sub={`${t.reserved} held · ${t.available} free`}
                />
              </button>
            ))}
          </div>

          {activeType ? (
            <Section title={`${TYPE_LABEL[activeType] ?? humanize(activeType)} stalls`} right={<span className="text-[11px] text-muted-foreground">green in use · amber held · grey free</span>}>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">
                {board.stalls.filter((s) => s.type === activeType).map((s) => (
                  <div key={s.id} className={`rounded border px-2 py-1 ${STATUS_TONE[s.status]}`} title={s.reservedUntil ? `held until ${simTime(s.reservedUntil)}` : undefined}>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{s.code.replace(/^NASH-/, "")}</div>
                    <div className="truncate font-mono text-[11px]">
                      {s.status === "occupied" ? s.vehicleName ?? "in use" : s.status === "reserved" ? `→ ${s.reservedForName ?? "held"}` : "free"}
                    </div>
                    {s.armPhase ? <div className="text-[10px] text-sky-300">arm: {s.armPhase}</div> : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          <Section
            title="Reservations"
            right={
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-7 rounded-md border border-border bg-card px-2 text-xs">
                <option value="all">All purposes ({res.length})</option>
                {byPurpose.map((p) => (
                  <option key={p.purpose} value={p.purpose}>{humanize(p.purpose)} ({p.active + p.held})</option>
                ))}
              </select>
            }
          >
            <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted-foreground">This run, every booking by outcome:</span>
              {["active", "held", "done", "released", "superseded", "interrupted"].map((k) => (
                <Chip key={k}>{k} <span className="font-mono">{ledger[k] ?? 0}</span></Chip>
              ))}
            </div>
            {res.length === 0 ? (
              <p className="text-xs text-muted-foreground">No held or active reservations right now.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Window</th>
                      <th className="py-1 pr-2 font-medium">Vehicle</th>
                      <th className="py-1 pr-2 font-medium">Purpose</th>
                      <th className="py-1 pr-2 font-medium">Stall</th>
                      <th className="py-1 pr-2 font-medium">State</th>
                      <th className="py-1 font-medium">Why (OTTO-Q)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.filter((r) => purpose === "all" || r.purpose === purpose).map((r) => (
                      <tr key={r.booking_id} className="border-t border-border align-top">
                        <td className="py-1 pr-2 font-mono whitespace-nowrap">{simTime(r.starts_at)} to {simTime(r.ends_at)}</td>
                        <td className="py-1 pr-2 font-mono whitespace-nowrap">{r.display_name}</td>
                        <td className="py-1 pr-2 whitespace-nowrap">{humanize(r.purpose)}</td>
                        <td className="py-1 pr-2 font-mono whitespace-nowrap">{r.stall_code?.replace(/^NASH-/, "") ?? "n/a"}</td>
                        <td className="py-1 pr-2">{r.state}</td>
                        <td className="py-1 text-muted-foreground">{r.why ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
