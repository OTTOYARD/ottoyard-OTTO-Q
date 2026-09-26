// Small presentational primitives shared by the live twin panels.
// Plain Tailwind + shadcn tokens only, so the same file renders in PULSE and OrchestrAV.
import type { ReactNode } from "react";
import type { Stage } from "@/lib/twin/model";
import type { DecisionTone } from "@/lib/twin/decisionText";

export const STAGE_TONE: Record<Stage, string> = {
  inbound: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  at_gate: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  queued: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  charging: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  servicing: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  staged: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
  departing: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  off_site: "bg-zinc-700/30 text-zinc-400 border-zinc-600/40",
  out_of_service: "bg-red-500/15 text-red-300 border-red-500/30",
  unknown: "bg-red-500/15 text-red-300 border-red-500/30",
};

/** Text colour of a decision verdict (decisionText.ts's tone), the same four the twin cockpit uses. */
export const DECISION_TONE: Record<DecisionTone, string> = {
  enacted: "text-emerald-300",
  held: "text-amber-300",
  warn: "text-red-300",
  idle: "text-muted-foreground",
};

export function Chip({ children, tone = "", title }: { children: ReactNode; tone?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 whitespace-nowrap ${tone || "border-border bg-secondary text-foreground"}`}>
      {children}
    </span>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold leading-7">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

/** SoC bar with the target marked. Missing SoC renders as "SoC not reported", never as 0. */
export function SocBar({ soc, target }: { soc: number | null; target: number | null }) {
  if (soc === null || soc === undefined) return <div className="text-[11px] text-muted-foreground">SoC not reported</div>;
  const pct = Math.max(0, Math.min(100, soc));
  const tone = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>SoC {Math.round(pct)}%</span>
        {target !== null && target !== undefined ? <span>target {Math.round(target)}%</span> : null}
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        {target !== null && target !== undefined ? (
          <div className="absolute top-0 h-full w-0.5 bg-foreground/70" style={{ left: `${Math.max(0, Math.min(100, target))}%` }} />
        ) : null}
      </div>
    </div>
  );
}

export function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
