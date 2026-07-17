// src/components/OttoQSequenceCard.tsx
// Compact per-vehicle "OTTO-Q Sequence" section rendered inside each Fleet-tab
// vehicle card. At rest (2 rows max): current step + thin progress bar + next
// step. Expanded: the full sequence (done / current / upcoming) with times and
// service-needs chips. Fed by ONE depot-wide ottoq_depot_cards call shared via
// the TanStack query cache (see use-ottoq-cards.ts) — never per-card requests.

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown } from "lucide-react";
import {
  useOttoqCards,
  selectCardFor,
  OttoQCardStep,
} from "@/hooks/use-ottoq-cards";

interface OttoQSequenceCardProps {
  vehicleId: string;
}

// Nicer display names for common leg types; anything else is humanized
// (underscores -> spaces, Title Case).
const LEG_LABELS: Record<string, string> = {
  arrive: "Arriving",
  arrival: "Arriving",
  travel_to_depot: "En route to depot",
  queue: "Queued",
  charge: "Charging",
  charging: "Charging",
  wash: "Wash",
  wash_bay: "Wash",
  detail: "Detailing",
  detail_bay: "Detailing",
  service: "Service",
  service_bay: "Service",
  inspection: "Inspection",
  calibration: "Sensor calibration",
  sensor_calibration: "Sensor calibration",
  stage: "Staging",
  staging: "Staging",
  staged: "Staged",
  deploy: "Deploying",
  dispatch: "Dispatching",
  depart: "Departing",
  park: "Parked",
};

const humanizeLeg = (legType: string): string => {
  const key = (legType || "").toLowerCase();
  if (LEG_LABELS[key]) return LEG_LABELS[key];
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const formatTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

function StepRow({ step }: { step: OttoQCardStep }) {
  if (step.status === "done") {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
        <span className="text-muted-foreground">{humanizeLeg(step.leg_type)}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {formatTime(step.actual_end ?? step.actual_start) ?? ""}
        </span>
      </div>
    );
  }
  if (step.status === "current") {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-3 h-3 flex items-center justify-center shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </span>
        <span className="font-medium text-primary">{humanizeLeg(step.leg_type)}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {formatTime(step.actual_start ?? step.planned_start) ?? ""}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-3 h-3 flex items-center justify-center shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      </span>
      <span className="text-muted-foreground">{humanizeLeg(step.leg_type)}</span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
        {formatTime(step.planned_start) ?? ""}
      </span>
    </div>
  );
}

export function OttoQSequenceCard({ vehicleId }: OttoQSequenceCardProps) {
  const [open, setOpen] = useState(false);
  const { data } = useOttoqCards();
  const entry = selectCardFor(data, vehicleId);

  // No live run / vehicle not in payload / no card — one quiet line, never fake data.
  if (!entry?.card) {
    return (
      <div className="border-t border-border/50 pt-2">
        <p className="text-xs text-muted-foreground">OTTO-Q: no live sequence</p>
      </div>
    );
  }

  const { card } = entry;
  const current = card.current_step;
  const next = card.next_step;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-t border-border/50 pt-2 space-y-1">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center gap-2 text-left">
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              OTTO-Q
            </span>
            {current ? (
              <>
                <span className="text-xs font-medium truncate">
                  {humanizeLeg(current.leg_type)}
                </span>
                <div className="flex-1 min-w-[24px] h-[2px] bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${current.progress_pct ?? 0}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="flex-1 text-xs text-muted-foreground truncate">
                queued{next ? ` — next: ${humanizeLeg(next.leg_type)}` : ""}
              </span>
            )}
            <ChevronDown
              className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        {current && next && !open && (
          <p className="text-xs text-muted-foreground">
            next: {humanizeLeg(next.leg_type)}
          </p>
        )}

        <CollapsibleContent className="animate-accordion-down">
          <div className="space-y-1 pt-1">
            {card.steps.map((step) => (
              <StepRow key={step.seq} step={step} />
            ))}
            {card.needs.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {card.needs.map((n) => (
                  <span
                    key={n.svc}
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      n.status === "done"
                        ? "bg-success/10 text-success border-success/30"
                        : "bg-muted/30 text-muted-foreground border-border/50"
                    }`}
                  >
                    {humanizeLeg(n.svc)}
                    {n.status === "done" && " ✓"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
