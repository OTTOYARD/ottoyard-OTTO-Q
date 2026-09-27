// What OttoCommand's "Proactive insights" shows: read from the live run, never canned. Pure, so it is tested on
// real feed rows without a run.
//
//   incidents   the newest things that went wrong on one vehicle, charger or the engine (critical first), in the
//               twin cockpit's words (./eventFeed), from the same split the Incidents view uses (./incidents)
//   conditions  depot-wide conditions the engine re-reports every tick while they hold
//   low charge  cars at the depot below 30% that are not on a charger
//   crew        approvals waiting on the crew in Prime Ops
//
// No live run means no insights: the panel says so instead of showing anything.
import type { CardVehicle } from "./cards";
import { describeEvent, eventTone, type RunEventRow } from "./eventFeed";
import { incidentGroups } from "./incidents";

export type InsightTone = "red" | "yellow" | "blue" | "green";

export interface Insight {
  /** Stable while the thing it describes is unchanged, so a dismissal holds until something new happens. */
  key: string;
  tone: InsightTone;
  text: string;
}

export const LOW_SOC_PCT = 30;
export const VERY_LOW_SOC_PCT = 15;
const MAX_INCIDENTS = 3;
const MAX_CONDITIONS = 2;
const MAX_NAMED = 3;

/** At the depot and not on a charger. Deployed and inbound cars are the recall's business, not the crew's. */
const AT_DEPOT_NOT_CHARGING = new Set([
  "arrived_at_gate", "staged_awaiting_service", "charge_complete_holding", "in_wash_bay", "in_detail_bay",
  "in_service_bay", "service_complete_holding", "staged_for_departure", "emergency_staged",
]);

function eventLine(r: RunEventRow): string {
  const t = describeEvent(r.event_type, r.payload);
  return t.detail ? `${t.title} · ${t.detail}` : t.title;
}

export function liveInsights(input: {
  runId: string | null;
  vehicles: CardVehicle[];
  feed: RunEventRow[] | null | undefined;
  pendingCrewApprovals: number;
  /** Formats a sim timestamp for display (the cockpits pass simTime). */
  clock: (iso: string) => string;
}): Insight[] {
  if (!input.runId) return [];
  const out: Insight[] = [];
  const { attention, standing } = incidentGroups(input.feed);

  const critical = attention.filter((r) => eventTone(r.severity) === "critical");
  const problems = attention.filter((r) => eventTone(r.severity) !== "critical");
  for (const r of [...critical, ...problems].slice(0, MAX_INCIDENTS)) {
    const who = r.entity_name ?? (r.entity_type === "sim_run" ? "Engine" : "Depot");
    out.push({
      key: `incident:${r.row_key}`,
      tone: eventTone(r.severity) === "critical" ? "red" : "yellow",
      text: `${who}: ${eventLine(r)} (${input.clock(r.sim_at)})`,
    });
  }

  for (const r of standing.slice(0, MAX_CONDITIONS)) {
    out.push({ key: `condition:${r.row_key}`, tone: "yellow", text: `${eventLine(r)} (since ${input.clock(r.first_sim_at)})` });
  }

  const low = input.vehicles
    .filter((v) => v.soc !== null && v.soc < LOW_SOC_PCT && AT_DEPOT_NOT_CHARGING.has(v.state))
    .sort((a, b) => (a.soc ?? 0) - (b.soc ?? 0) || a.display_name.localeCompare(b.display_name));
  if (low.length > 0) {
    // floor, so a car at 29.6% never reads "30%" in a line that says below 30%
    const named = low.slice(0, MAX_NAMED).map((v) => `${v.display_name} ${Math.floor(v.soc ?? 0)}%`).join(", ");
    const more = low.length > MAX_NAMED ? ` and ${low.length - MAX_NAMED} more` : "";
    out.push({
      key: `low-soc:${low.map((v) => v.vehicle_id).sort().join(",")}`,
      tone: low.some((v) => (v.soc ?? 100) < VERY_LOW_SOC_PCT) ? "red" : "yellow",
      text: `${low.length} vehicle${low.length === 1 ? "" : "s"} at the depot below ${LOW_SOC_PCT}% and not on a charger: ${named}${more}`,
    });
  }

  if (input.pendingCrewApprovals > 0) {
    const n = input.pendingCrewApprovals;
    out.push({ key: `approvals:${n}`, tone: "blue", text: `${n} approval${n === 1 ? "" : "s"} waiting on the crew in Prime Ops` });
  }

  if (out.length === 0) out.push({ key: "quiet", tone: "green", text: "Nothing needs attention on the live run." });
  return out;
}
