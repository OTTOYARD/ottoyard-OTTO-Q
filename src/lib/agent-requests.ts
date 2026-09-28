// A fleet owner's agent requests: what outside agents (the owner's own fleet agent, or a personal agent such as
// Chase's Hermes bot) have asked OTTO-Q about this owner's vehicles, and what became of each ask.
// otto-q-core 0550 builds the read, public.ottoq_agent_requests_for_operator(fleet_operator_id, depot_id, limit);
// 0551 is the separate, optional grant that lets this cockpit's anon key call it.
//
// Scoping is the DATABASE's: it returns one operator's requests and never all operators at once. The operator is
// picked on this device (OperatorScope), which is the known gap this cockpit carries -- so this panel is READ-ONLY by
// design, and deciding stays with the depot crew in OTTO-PULSE until OrchestrAV signs its users in to the engine.
import { ottoqRpc } from "@/lib/otto-q-api";
import { humanize } from "@/lib/twin/model";

export const TWIN_DEPOT_ID = "11111111-1111-1111-1111-111111111111";

export interface AgentRequest {
  request_id: string;
  kind: "note" | "recall_vehicle" | "ops_action" | "adjustment" | string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  priority: string;
  /** Effective status: a pending request past its expiry reads 'expired' even before it is recorded so. */
  status: string;
  lapsed: boolean;
  principal: { name: string; kind: string };
  vehicle: { id: string; label: string | null; state: string | null; soc: number | null } | null;
  /** SIMULATION time: the run's clock when the agent asked. */
  sim_clock: string | null;
  /** REAL time (UTC), like decided_at. */
  created_at: string;
  expires_at: string;
  /** The operator's view names the kind of decider (crew / operator), never the person. */
  decided_by: { kind: string } | null;
  decided_at: string | null;
  decision_note: string | null;
  engine_door: string | null;
  engine_reply: Record<string, unknown> | null;
}

export interface OperatorAgentRequests {
  ok: true;
  fleet_operator: { id: string; name: string };
  depot_id: string;
  can_decide: boolean;
  decide_note: string | null;
  counts: { open: number; total: number };
  items: AgentRequest[];
}
export interface OperatorAgentRequestsRefusal {
  ok: false;
  error: string;
  message?: string;
}
export type OperatorAgentRequestsReply = OperatorAgentRequests | OperatorAgentRequestsRefusal;

export const isAnswered = (r: OperatorAgentRequestsReply): r is OperatorAgentRequests => r.ok === true;

/** One owner's requests at the twin depot, through the cockpit's one OTTO-Q client. */
export function fetchOperatorAgentRequests(fleetOperatorId: string, depotId: string = TWIN_DEPOT_ID, limit = 50) {
  return ottoqRpc<OperatorAgentRequestsReply>("ottoq_agent_requests_for_operator", {
    p_fleet_operator_id: fleetOperatorId,
    p_depot_id: depotId,
    p_limit: limit,
  });
}

export type RequestsProblem = "not_enabled" | "not_granted" | "error";

/**
 * ottoqRpc throws "OTTO-Q rpc <fn> <status>: <body>". Tell apart: the function is not in the database (0550 not
 * applied: 404 / PGRST202 / 42883), the function exists but this cockpit's anon key may not call it (0551 not
 * applied: 401 / 403 / 42501), and any other failure. The first two are the expected states before the gateway is
 * switched on; both read as "built but not enabled yet".
 */
export function classifyRequestsError(err: unknown): RequestsProblem {
  const text = err instanceof Error ? err.message : String(err ?? "");
  const status = Number(/^OTTO-Q rpc \S+ (\d{3}):/.exec(text)?.[1] ?? NaN);
  if (status === 404 || /PGRST202|"42883"|could not find the function/i.test(text)) return "not_enabled";
  if (status === 401 || status === 403 || /"42501"|permission denied/i.test(text)) return "not_granted";
  return "error";
}

export type Tone = "open" | "good" | "bad" | "warn" | "muted";

/** How a status reads to the owner, and the sentence that makes it true rather than reassuring. */
export function statusMeta(r: Pick<AgentRequest, "status" | "kind">): { label: string; tone: Tone; explain: string } {
  switch (r.status) {
    case "pending":
      return { label: "Waiting for a decision", tone: "open", explain: "Nothing happens until a person decides." };
    case "acknowledged":
      return { label: "Acknowledged", tone: "good", explain: "Read by the crew. A note changes nothing in the engine." };
    case "declined":
      return { label: r.kind === "note" ? "Dismissed" : "Declined", tone: "muted", explain: "Nothing in the engine changed." };
    case "expired":
      return { label: "Expired", tone: "muted", explain: "Nobody decided before it expired. Nothing in the engine changed." };
    case "applied":
      return { label: "Applied by OTTO-Q", tone: "good", explain: "OTTO-Q's own door accepted it." };
    case "refused_by_engine":
      return { label: "Refused by OTTO-Q", tone: "bad", explain: "Approved, and OTTO-Q's door refused it." };
    case "approved_no_engine_door":
      return { label: "Approved · no engine door", tone: "warn", explain: "OTTO-Q has no door for this yet: the approval is recorded and nothing in the engine changed." };
    case "approved_not_applied":
      return { label: "Approved · not applied", tone: "warn", explain: "Approved, but the door was not called." };
    case "apply_failed":
      return { label: "Approved · door failed", tone: "bad", explain: "Approved, and the call to OTTO-Q's door failed." };
    default:
      return { label: humanize(r.status), tone: "muted", explain: "" };
  }
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "note": return "Note";
    case "recall_vehicle": return "Recall request";
    case "ops_action": return "Ops action";
    case "adjustment": return "Adjustment";
    default: return humanize(kind);
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The engine's reply as the owner needs to read it; null when there is nothing to say. */
export function engineOutcome(r: Pick<AgentRequest, "status" | "engine_door" | "engine_reply">): string | null {
  const reply = r.engine_reply ?? {};
  switch (r.status) {
    case "applied":
      if (r.engine_door === "ottoq_hw_recall_vehicle") {
        const cmd = str(reply.command_id);
        return `Recall ${str(reply.note) ?? "queued"}${cmd ? ` (command ${cmd.slice(0, 8)})` : ""}.`;
      }
      if (r.engine_door === "ottoq_apply_ops_action") {
        return reply.status === "no_change" ? "Already in force: OTTO-Q changed nothing." : "OTTO-Q set it on the live run.";
      }
      return null;
    case "refused_by_engine": {
      const why = str(reply.error) ?? str(reply.reason) ?? str(reply.message);
      return why ? `OTTO-Q said: ${humanize(why)}` : "OTTO-Q refused it.";
    }
    case "approved_not_applied":
    case "approved_no_engine_door":
      return str(reply.reason);
    case "apply_failed":
      return str(reply.error) ? `Error: ${str(reply.error)}` : null;
    default:
      return null;
  }
}

/** Who decided, in the words the owner's view is allowed: the depot crew or the owner. */
export function deciderText(r: Pick<AgentRequest, "decided_by">): string | null {
  if (!r.decided_by) return null;
  return r.decided_by.kind === "crew" ? "the depot crew" : r.decided_by.kind === "operator" ? "your team" : humanize(r.decided_by.kind);
}

export const isOpen = (r: AgentRequest): boolean => r.status === "pending" && !r.lapsed;

/** Open asks first (oldest first, so the longest-waiting reads first), then the rest newest first. */
export function splitRequests(items: AgentRequest[]): { open: AgentRequest[]; closed: AgentRequest[] } {
  const open = items.filter(isOpen).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const closed = items.filter((r) => !isOpen(r))
    .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
  return { open, closed };
}

/** A real (UTC) timestamp as a person in Nashville reads it: "Sep 28, 12:43 AM CT". */
export function realTimeCT(iso: string | null | undefined): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return `${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" })} CT`;
}
