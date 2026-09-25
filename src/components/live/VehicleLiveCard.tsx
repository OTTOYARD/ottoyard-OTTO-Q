// One vehicle, live. At rest: owner, state, SoC vs target, stall, current step + progress,
// next step, open needs. Expanded: reservations with OTTO-Q's reason, the last decision and
// its rationale, the decision history, and the twin variables this vehicle was dealt.
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { FleetRow } from "@/lib/twin/model";
import { STAGE_LABEL, humanize, rationaleText, simTime } from "@/lib/twin/model";
import { useActivityFeed } from "@/lib/twin/hooks";
import { Chip, SocBar, STAGE_TONE, fmt } from "./ui";

const LEG_LABELS: Record<string, string> = {
  charge_dcfc: "DC fast charge",
  charge_l2: "Level 2 charge",
  wash: "Wash bay",
  detail: "Detailing",
  service: "Service bay",
  calibration: "Sensor calibration",
  inspection: "Inspection",
  stage: "Stage for dispatch",
  taxi: "Taxi",
  depart: "Depart",
  arrive: "Arrive at depot",
};
const leg = (s: string | null | undefined) => (s ? LEG_LABELS[s] ?? humanize(s) : "");

function Needs({ row }: { row: FleetRow }) {
  // The twin's visit atoms carry est minutes + must_do; the card's needs are the same atoms
  // from ottoq_visit_needs. Prefer the snapshot visit (it is the open visit), else the card.
  const atoms = row.visit?.atoms ?? row.card?.needs?.map((n) => ({ svc: n.svc, status: n.status, must_do: !!n.must_do, est_min: null })) ?? [];
  const open = atoms.filter((a) => a.status !== "done" && a.status !== "skipped" && a.status !== "cancelled");
  if (!open.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {open.map((a, i) => (
        <Chip
          key={`${a.svc}-${i}`}
          tone={a.must_do ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : undefined}
          title={a.must_do ? "must do before dispatch" : "deferrable"}
        >
          {humanize(a.svc)}
          {a.est_min ? <span className="font-mono text-muted-foreground">{a.est_min}m</span> : null}
        </Chip>
      ))}
    </div>
  );
}

function Variables({ row }: { row: FleetRow }) {
  const c = row.condition;
  if (!c) return <p className="text-[11px] text-muted-foreground">Twin variables not drawn for this run.</p>;
  const items: [string, string][] = [
    ["Battery health", `${fmt(c.battery_soh_pct, 1)}%`],
    ["Energy use vs fleet", `×${fmt(c.consumption_scalar, 3)}`],
    ["Charge curve vs spec", `×${fmt(c.charge_curve_scalar, 3)}`],
    ["Soiling rate", `×${fmt(c.soil_rate, 3)}`],
    ["Wash due", `${fmt(c.cycles_since_wash)} of ${fmt(c.wash_cadence_cycles)} cycles`],
    ["PM interval", `${fmt(c.pm_interval_km)} km`],
    ["Calibration interval", `${fmt(c.calib_interval_h)} h`],
    ["Service speed", `×${fmt(c.service_speed_scalar, 3)}`],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="text-[11px]">
          <div className="text-muted-foreground">{k}</div>
          <div className="font-mono">{v}</div>
        </div>
      ))}
    </div>
  );
}

function History({ runId, vehicleId }: { runId: string; vehicleId: string }) {
  const { data, isLoading } = useActivityFeed(runId, { vehicleId, limit: 8, changesOnly: true });
  if (isLoading) return <p className="text-[11px] text-muted-foreground">Loading decisions…</p>;
  if (!data?.length) return <p className="text-[11px] text-muted-foreground">No OTTO-Q decisions for this vehicle yet this run.</p>;
  return (
    <ol className="space-y-1">
      {data.map((d) => (
        <li key={d.decision_seq} className="grid grid-cols-[64px_1fr] gap-2 text-[11px]">
          <span className="font-mono text-muted-foreground">{simTime(d.occurred_at)}</span>
          <span>
            <span className="font-medium">{humanize(d.action)}</span>
            {d.target ? <span className="font-mono"> → {d.target}</span> : null}
            <span className="text-muted-foreground"> · {d.outcome}{d.engine ? ` · ${d.engine}` : ""}</span>
            {rationaleText(d.rationale) ? <span className="block text-muted-foreground">{rationaleText(d.rationale)}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function VehicleLiveCard({
  row,
  runId,
  expanded,
  onToggle,
  showOperator = true,
}: {
  row: FleetRow;
  runId: string;
  expanded: boolean;
  onToggle: () => void;
  showOperator?: boolean;
}) {
  const cur = row.card?.current_step ?? null;
  const next = row.card?.next_step ?? null;
  const active = row.reservations.filter((r) => r.state === "active");
  const held = row.reservations.filter((r) => r.state !== "active");
  const dec = row.lastDecision;
  return (
    <div id={`vehicle-${row.id}`} className="rounded-lg border border-border bg-card p-3">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-semibold">{row.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {[showOperator ? row.operatorName : null, [row.oem, row.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Chip tone={STAGE_TONE[row.stage]} title={row.state}>{row.stage === "unknown" ? row.state : STAGE_LABEL[row.stage]}</Chip>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        <div className="mt-2"><SocBar soc={row.soc} target={row.targetSoc} /></div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="font-mono text-foreground">{row.stallCode ?? "no stall"}</span>
          </span>
          <span className="text-muted-foreground">{humanize(row.state)}</span>
          {active.length > 1 ? (
            <Chip tone="border-red-500/40 bg-red-500/10 text-red-300" title="more than one ACTIVE reservation at once">
              {active.length} active holds
            </Chip>
          ) : null}
        </div>

        {cur ? (
          <div className="mt-2">
            <div className="flex justify-between text-[11px]">
              <span>Now: <span className="font-medium">{leg(cur.leg_type)}</span></span>
              <span className="font-mono text-muted-foreground">until {simTime(cur.planned_end)}</span>
            </div>
            {typeof cur.progress_pct === "number" ? (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, cur.progress_pct))}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        {next ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Next: <span className="text-foreground">{leg(next.leg_type)}</span> at <span className="font-mono">{simTime(next.planned_start)}</span>
          </div>
        ) : null}

        <div className="mt-2"><Needs row={row} /></div>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reservations</div>
            {row.reservations.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">None held or active.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...active, ...held].map((b) => (
                  <li key={b.booking_id} className="text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={b.state === "active" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : undefined}>{b.state}</Chip>
                      <span className="font-medium">{humanize(b.purpose)}</span>
                      <span className="font-mono">{b.stall_code ?? "stall n/a"}</span>
                      <span className="font-mono text-muted-foreground">{simTime(b.starts_at)} to {simTime(b.ends_at)}</span>
                    </div>
                    {b.why ? <div className="mt-0.5 text-muted-foreground">{b.why}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">OTTO-Q decisions</div>
            {dec ? (
              <p className="mb-1 text-[11px]">
                Latest: <span className="font-medium">{humanize(dec.action)}</span>
                {dec.verb ? <span className="font-mono"> ({dec.verb})</span> : null}
                <span className="text-muted-foreground"> · {dec.outcome} · {simTime(dec.at)}</span>
              </p>
            ) : null}
            <History runId={runId} vehicleId={row.id} />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Twin variables (dealt at run start)</div>
            <Variables row={row} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
