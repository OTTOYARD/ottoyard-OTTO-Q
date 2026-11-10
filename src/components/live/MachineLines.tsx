// A car's machines, on its card: what the depot's robots are doing to this car now (or did on this visit), the car's
// plan stage by stage with the machine that does each stage, and, for an owner, what each of those machines does.
//
// Chase, 2026-11-09: "Orchestra needs just user/asset/vehicle owner detail from a stall or stage perspective."
// Every line is read from the car's own records (lib/twin/robots.ts): its arm cycle or its stall's hold, its visit's
// needs, its seat in a wash bay, its plan's steps. The same file renders in OTTO-PULSE and OrchestrAV.
import { Bot, Check, Circle, Play } from "lucide-react";
import type { CardStep } from "@/lib/twin/cards";
import { simTime, stepLabel, type FleetRow } from "@/lib/twin/model";
import { placeName } from "@/lib/twin/plainWords";
import { MACHINE_WORD, byMachineWords, machineFacts, planStages, stepBySensors, stepMachine, type MachineKey, type MachineLine } from "@/lib/twin/robots";

/** What one machine does, in an owner's words, as a hover text. */
const ownerTitle = (k: MachineKey) => machineFacts(k).owner.join(" ");

/** The machines at work on this car now, and the ones that have finished on this visit. One short line each. */
export function MachineLines({ lines }: { lines: MachineLine[] }) {
  if (!lines.length) return null;
  return (
    <ul className="mt-2 space-y-1" data-testid="machine-lines">
      {lines.map((l) => (
        <li key={`${l.machine}-${l.title}`} className="text-[11px]" title={ownerTitle(l.machine)} data-machine={l.machine} data-state={l.state}>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <Bot className={`h-3 w-3 shrink-0 self-center ${l.state === "working" ? "text-emerald-300" : "text-muted-foreground"}`} aria-hidden />
            <span className="font-medium">{l.title}</span>
            <span className={l.state === "working" ? "text-emerald-300" : "text-muted-foreground"}>{l.words}</span>
            {l.state === "working" && l.endsAt ? <span className="font-mono text-muted-foreground">until {simTime(l.endsAt)}</span> : null}
            {l.state === "done" && l.doneAt ? <span className="font-mono text-muted-foreground">{simTime(l.doneAt)}</span> : null}
          </div>
          {l.state === "working" && l.progress !== null ? (
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(l.progress)}>
              <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, l.progress))}%` }} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function when(s: CardStep): string {
  if (s.status === "done") {
    const a = s.actual_start ?? s.planned_start, b = s.actual_end ?? s.planned_end;
    // a step the engine records at one instant (run a0001fd6: 5 of 13 sensor cleans) reads as done then, not as a span
    return a && b && simTime(a) !== simTime(b) ? `${simTime(a)} to ${simTime(b)}` : b ? `done ${simTime(b)}` : "done";
  }
  if (s.status === "current") {
    const a = s.actual_start ?? s.planned_start, b = s.expected_end ?? s.planned_end;
    return [a ? `since ${simTime(a)}` : "", b ? `until ${s.eta_source === "charge_physics" ? "~" : ""}${simTime(b)}` : ""].filter(Boolean).join(" · ") || "now";
  }
  return s.planned_start ? `planned ${simTime(s.planned_start)}` : "planned";
}

/** The needs of the car's open visit: the snapshot's atoms (they carry the times), else the card's. */
const needsOf = (row: Pick<FleetRow, "visit" | "card">) => row.visit?.atoms ?? row.card?.needs ?? [];

/**
 * The car's visit, stage by stage: done, under way, to come, each with its station and times, and the machine that
 * does it. A stage with no machine named is a technician's, or needs none. lib/twin/robots planStages says what is
 * left out (travel, a planning record that never ran) and what is added (work under way the plan's steps do not list).
 */
export function VisitPlan({ row }: { row: Pick<FleetRow, "card" | "visit" | "stallCode" | "stallKind"> }) {
  const needs = needsOf(row);
  const stages = planStages(row.card?.steps, needs, { code: row.stallCode, kind: row.stallKind });
  if (!stages.length) return <p className="text-[11px] text-muted-foreground">OTTO-Q has published no plan for this visit.</p>;
  return (
    <ol className="space-y-1" data-testid="visit-plan">
      {stages.map((s) => {
        const machine = stepMachine(s, needs);
        const sensors = !machine && stepBySensors(s, needs);
        const place = s.to_stall_code ? placeName(s.to_stall_code, s.to_stall_kind ?? undefined) : null;
        const Icon = s.status === "done" ? Check : s.status === "current" ? Play : Circle;
        const tone = s.status === "done" ? "text-emerald-300" : s.status === "current" ? "text-sky-300" : "text-muted-foreground";
        return (
          <li key={s.seq} className="grid grid-cols-[14px_1fr] gap-1.5 text-[11px]" data-status={s.status} data-machine={machine ?? (sensors ? "charger_sensors" : undefined)}>
            <Icon className={`mt-0.5 h-3 w-3 ${tone}`} aria-label={s.status === "done" ? "done" : s.status === "current" ? "under way" : "to come"} />
            <div className="min-w-0">
              <span className={s.status === "upcoming" ? "text-muted-foreground" : "font-medium"}>{stepLabel(s)}</span>
              {machine ? <span className="text-emerald-300/90" title={ownerTitle(machine)}> · {byMachineWords(machine)}</span> : null}
              {sensors ? <span className="text-sky-300/90" title="The charger's own sensors do this during the charge. No technician."> · by the charger's sensors</span> : null}
              <div className="truncate text-muted-foreground">
                {place ? <span className="font-mono">{place} · </span> : null}
                <span className="font-mono">{when(s)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The machines that work on this car on this visit, each in an owner's words, under their own heading. Nothing at
 *  all when no machine does. */
export function MachineNotes({ row, lines }: { row: Pick<FleetRow, "card" | "visit">; lines: MachineLine[] }) {
  const needs = needsOf(row);
  const keys = new Set<MachineKey>(lines.map((l) => l.machine));
  for (const s of row.card?.steps ?? []) {
    const k = stepMachine(s, needs);
    if (k) keys.add(k);
  }
  const order: MachineKey[] = ["charge_arm", "clean_arm", "wash_gantry"];
  const shown = order.filter((k) => keys.has(k));
  if (!shown.length) return null;
  return (
    <div data-testid="machine-notes">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">The depot's machines on this visit</div>
      <dl className="space-y-1.5">
        {shown.map((k) => (
          <div key={k} className="text-[11px]">
            <dt className="font-medium">{MACHINE_WORD[k]}</dt>
            <dd className="text-muted-foreground">{machineFacts(k).owner.join(" ")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
