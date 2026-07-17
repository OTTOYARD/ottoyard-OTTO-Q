import { useState } from "react";
import { useScheduleIntelligence, useReoptimizeDepot } from "@/hooks/use-otto-q-strategic";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { SchedulingTimeline } from "./scheduling-timeline";
import {
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  PendingOptimization,
  AppliedOptimization,
  ScheduleIntelligence,
} from "@/lib/otto-q-api";

export function FleetSchedulingTile() {
  const [horizon, setHorizon] = useState<"12h" | "24h" | "48h">("24h");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const { data, isLoading } = useScheduleIntelligence(horizon);
  const reopt = useReoptimizeDepot();

  if (isLoading || !data) {
    return (
      <Card className="p-5 space-y-4">
        <div className="h-6 w-48 rounded bg-muted/40 animate-pulse" />
        <div className="h-32 w-full rounded bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 rounded bg-muted/30 animate-pulse" />
          <div className="h-40 rounded bg-muted/30 animate-pulse" />
        </div>
      </Card>
    );
  }

  const filteredPending = categoryFilter
    ? data.pending_optimizations.filter((p) => p.category === categoryFilter)
    : data.pending_optimizations;

  const categories = Array.from(
    new Set(data.pending_optimizations.map((p) => p.category))
  );

  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 border border-primary/20">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">Fleet Scheduling</h3>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                OTTO-Q Engine
              </span>
              <EngineStatusIndicator status={data.engine_status} />
            </div>
            <p className="text-xs text-muted-foreground">
              AI-driven horizon across {data.engine_status.depots_tracked} active depot
              {data.engine_status.depots_tracked !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() =>
              reopt.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success("Depot re-optimized", {
                    description: `${r?.summary?.vehicles_planned ?? 0} vehicles · ${r?.summary?.charge_assigned ?? 0} charge (${r?.summary?.charge_source ?? "-"}) · ${r?.summary?.tasks_awaiting_resource ?? 0} awaiting`,
                  }),
                onError: (e) => toast.error("Re-optimize failed", { description: e.message }),
              })
            }
            disabled={reopt.isPending}
            title="Run OTTO-Q depot-wide re-optimization (cuOpt + energy cap + safety shield)"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50"
          >
            {reopt.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Re-optimize
          </button>
          <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 p-0.5">
            {(["12h", "24h", "48h"] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  horizon === h
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatBlock
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Waves"
          value={data.summary.waves_count}
        />
        <StatBlock
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="High Risk"
          value={data.summary.high_risk_waves}
          warn={data.summary.high_risk_waves > 0}
        />
        <StatBlock
          icon={<Brain className="h-3.5 w-3.5" />}
          label="Pending"
          value={data.summary.pending_count}
        />
        <StatBlock
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Applied 24h"
          value={data.summary.applied_count_24h}
        />
        <StatBlock
          icon={<Zap className="h-3.5 w-3.5" />}
          label="kWh Saved"
          value={(data.summary.estimated_savings_kwh_24h ?? 0).toFixed(0)}
          sub="24h"
        />
        <StatBlock
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Cost Saved"
          value={`$${(data.summary.estimated_savings_usd_24h ?? 0).toFixed(0)}`}
          sub="24h"
        />
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Timeline</h4>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-primary/60" />
              Demand forecast
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60" />
              Solar
            </span>
          </div>
        </div>
        <SchedulingTimeline
          window={data.window}
          waves={data.waves}
          forecast={data.demand_forecast}
        />
      </div>

      {/* Body: pending + applied */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending */}
        <div className="rounded-md border border-border/40 bg-muted/5 p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Pending AI Recommendations</h4>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ranked by priority score (confidence × category severity × recency)
              </p>
            </div>
          </div>

          {categories.length > 0 && (
            <CategoryFilter
              categories={categories}
              active={categoryFilter}
              onChange={setCategoryFilter}
            />
          )}

          {filteredPending.length === 0 ? (
            <EmptyState
              icon={<Brain className="h-6 w-6" />}
              title={
                categoryFilter
                  ? `No ${categoryFilter} recommendations`
                  : "No pending recommendations"
              }
              subtitle="The engine is monitoring. New predictions surface every snapshot cycle."
            />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredPending.map((opt) => (
                <PendingOptimizationRow key={opt.id} optimization={opt} />
              ))}
            </div>
          )}
        </div>

        {/* Applied */}
        <div className="rounded-md border border-border/40 bg-muted/5 p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h4 className="text-sm font-semibold">Applied Actions (24h)</h4>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Closed-loop — each action is scored against actual outcome
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {data.applied_optimizations_24h.length} total
            </span>
          </div>

          {data.applied_optimizations_24h.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6" />}
              title="No actions taken in last 24h"
              subtitle="Applied actions with outcomes will appear here once the engine acts."
            />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {data.applied_optimizations_24h.map((act) => (
                <AppliedOptimizationRow key={act.id} action={act} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// -------------- Sub-components --------------

function EngineStatusIndicator({
  status,
}: {
  status: ScheduleIntelligence["engine_status"];
}) {
  const isLive = status.healthy;
  const ageText =
    status.snapshot_age_min !== null ? formatAge(status.snapshot_age_min) : "no data";

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className="relative inline-flex h-2 w-2">
        {isLive && (
          <span className="absolute inset-0 inline-flex rounded-full bg-green-500 opacity-60 animate-ping" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isLive ? "bg-green-500" : "bg-amber-500"
          }`}
        />
      </span>
      <span className={isLive ? "text-green-500 font-medium" : "text-amber-500 font-medium"}>
        {isLive ? "Engine Live" : "Engine Warming"}
      </span>
      <span>· {ageText}</span>
    </span>
  );
}

function StatBlock({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-2.5 bg-muted/10 ${
        warn ? "border-red-500/40 bg-red-500/5" : "border-border/40"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function CategoryFilter({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string | null;
  onChange: (c: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onChange(null)}
        className={`px-2 py-0.5 text-[11px] rounded-md transition ${
          !active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(active === c ? null : c)}
          className={`px-2 py-0.5 text-[11px] rounded-md transition ${
            active === c
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {formatCategory(c)}
        </button>
      ))}
    </div>
  );
}

function PendingOptimizationRow({
  optimization: o,
}: {
  optimization: PendingOptimization;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2.5 hover:bg-background/60 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <CategoryBadge category={o.category} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-semibold leading-snug">{o.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {o.description}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>{o.depot_name}</span>
              {o.vehicle_display_name && (
                <>
                  <span>·</span>
                  <span>{o.vehicle_display_name}</span>
                </>
              )}
              {o.fleet_operator_name && (
                <>
                  <span>·</span>
                  <span>{o.fleet_operator_name}</span>
                </>
              )}
            </div>
            {o.risk_factors.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {o.risk_factors.slice(0, 3).map((rf) => (
                  <span
                    key={rf}
                    className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground"
                  >
                    {rf.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <ConfidenceBadge confidence={o.confidence} />
          <span className="text-[9px] text-muted-foreground tabular-nums">
            P: {o.priority_score.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AppliedOptimizationRow({ action: a }: { action: AppliedOptimization }) {
  const statusColor =
    a.status === "completed"
      ? "text-green-500 bg-green-500/10 border-green-500/20"
      : a.status === "failed" || a.status === "skipped"
      ? "text-red-500 bg-red-500/10 border-red-500/20"
      : a.status === "rolled_back"
      ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
      : "text-blue-500 bg-blue-500/10 border-blue-500/20";

  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
      <div className="flex items-start gap-2">
        <CategoryBadge category={a.category} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold leading-snug">
              {a.summary || formatActionType(a.action_type)}
            </div>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${statusColor}`}
            >
              {a.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{a.depot_name}</span>
            <span>·</span>
            <span>{formatApprovalMethod(a.approval_method)}</span>
            <span>·</span>
            <span>{timeAgo(a.created_at)}</span>
          </div>
          {(a.estimated_savings_kwh || a.estimated_savings_usd) && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {a.estimated_savings_kwh != null && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 tabular-nums">
                  <Zap className="h-3 w-3" />
                  {a.estimated_savings_kwh.toFixed(1)} kWh
                </span>
              )}
              {a.estimated_savings_usd != null && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 tabular-nums">
                  <TrendingUp className="h-3 w-3" />${a.estimated_savings_usd.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    timing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    load_balancing: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    energy_policy: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    capacity: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    health: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    notification: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    other: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };
  const className = styles[category] || styles.other;
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${className}`}
    >
      {formatCategory(category)}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.85
      ? "text-green-500"
      : confidence >= 0.6
      ? "text-amber-500"
      : "text-muted-foreground";
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${color}`}>{pct}%</span>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2 text-muted-foreground">
      <div className="opacity-50">{icon}</div>
      <div className="text-xs font-medium text-foreground">{title}</div>
      <div className="text-[11px] max-w-xs">{subtitle}</div>
    </div>
  );
}

// -------------- Helpers --------------

function formatCategory(c: string): string {
  return c
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatActionType(t: string): string {
  return t
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatApprovalMethod(m: string): string {
  const map: Record<string, string> = {
    auto_threshold: "Auto (conf threshold)",
    human_approved: "Human approved",
    claude_reasoning: "Claude reasoning",
    cron_triggered: "Scheduled cycle",
  };
  return map[m] || m;
}

function formatAge(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  const hours = min / 60;
  if (hours < 24) return `${hours.toFixed(1)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
