// What an owner's agent has set on its own cars, as this cockpit reads it: otto-q-core 0606's
// public.ottoq_owner_board(fleet_operator_id, depot_id, command_id), an anon-executable, read-only view of 0605's owner
// settings. Per car: a charge limit, a hold, service orders. As a list: the owner's recent commands with OTTO-Q's
// plain-English receipts. And, for a receipt link, the one command the link names.
//
// READ-ONLY by design, like the agent requests panel: an owner's agent changes these through OTTO-Q's agent gateway,
// with its own token, and OTTO-Q applies them at its next tick. This cockpit shows them; it changes nothing.
import { ottoqRpc } from "@/lib/otto-q-api";
import { TWIN_DEPOT_ID, classifyRequestsError, type RequestsProblem, type Tone } from "@/lib/agent-requests";
import { humanize } from "@/lib/twin/model";

export interface OwnerOrder {
  service: string;
  /** The catalog's display name, e.g. "Exterior wash". */
  name: string | null;
  when: "now" | "next_return" | "every_return" | string;
}

/** One car's settings in force, keyed by vehicle id in `by_vehicle`. */
export interface OwnerCarSettings {
  charge_limit_pct?: number;
  /** What the car charges to with no limit: the owner's contract ceiling. */
  full_pct?: number;
  hold_until_sim?: string;
  /** "6:00 AM sim time" -- SIMULATION time, Nashville local. */
  hold_until_local?: string;
  orders?: OwnerOrder[];
}

export interface OwnerInForce {
  setting_id: string;
  kind: "charge_limit" | "hold" | "service" | string;
  vehicle_id: string;
  vehicle: string;
  charge_limit_pct?: number;
  hold_until_sim?: string;
  hold_until_local?: string;
  service?: string;
  service_name?: string;
  when?: string;
  set_at: string;
  set_at_local: string;
  command_id: string;
  /** Set, and not yet applied by OTTO-Q's tick (it applies at the next one). */
  waiting_for_tick?: boolean;
}

export interface OwnerEffect {
  vehicle_id: string;
  vehicle: string;
  key: string;
  before?: unknown;
  after?: unknown;
  change?: boolean;
  group?: string;
  /** OTTO-Q's sentence for this car: "Tesla-AV-041 is charging (now 72%) and will stop at 90%." */
  now?: string;
  state?: string;
  soc?: number;
}

export interface OwnerCommand {
  command_id: string;
  tool: string;
  outcome: "applied" | "no_change" | "refused" | string;
  /** OTTO-Q's plain-English receipt, as the agent received it. */
  summary: string;
  /** The agent's name. Never a token or principal id. */
  agent: string;
  cars?: number;
  vehicle_ids?: string[];
  /** The command a receipt link names carries its cars and per-car effects in full. */
  vehicles?: { id: string; name: string }[];
  effects?: OwnerEffect[];
  args?: Record<string, unknown>;
  created_at: string;
  /** REAL time, Nashville local: "9:11 PM CT". */
  created_at_local: string;
  /** SIMULATION time when it was sent: "7:00 AM sim time". */
  sim_clock_local?: string;
  sim_run_id?: string;
  /** The command's run is the live one now. */
  live_run: boolean;
  link?: string;
  refusal?: { code: string; message: string; hint?: string };
  undone_at?: string;
  lifted_at?: string;
  lifted_reason?: string;
}

export interface OwnerBoard {
  ok: true;
  fleet_operator: { id: string; name: string };
  depot_id: string;
  run: { sim_run_id: string; status: string; demo: boolean; sim_clock: string; sim_clock_local: string } | null;
  full_pct: number;
  in_force: OwnerInForce[];
  by_vehicle: Record<string, OwnerCarSettings>;
  counts: { charge_limits: number; holds: number; orders: number };
  commands: OwnerCommand[];
  highlight: OwnerCommand | null;
  resets: string;
  clocks: string;
}
export interface OwnerBoardRefusal {
  ok: false;
  error: string;
  message?: string;
}
export type OwnerBoardReply = OwnerBoard | OwnerBoardRefusal;

export const isBoard = (r: OwnerBoardReply | undefined | null): r is OwnerBoard => !!r && r.ok === true;

/** One owner's board at the twin depot; with a command id, that command in full (a receipt link). */
export function fetchOwnerBoard(fleetOperatorId: string, commandId: string | null = null, depotId: string = TWIN_DEPOT_ID) {
  return ottoqRpc<OwnerBoardReply>("ottoq_owner_board", {
    p_fleet_operator_id: fleetOperatorId,
    p_depot_id: depotId,
    p_command_id: commandId,
  });
}

/** Not installed (0605/0606 not applied), installed but not granted to this cockpit, or a real failure. */
export const classifyBoardError = (err: unknown): RequestsProblem => classifyRequestsError(err);

export function whenLabel(when: string | null | undefined): string {
  switch (when) {
    case "now": return "this visit";
    case "next_return": return "next return";
    case "every_return": return "every return";
    default: return when ? humanize(when) : "";
  }
}

export interface SettingChip {
  key: string;
  label: string;
  title: string;
}

/** A car's settings as chips on its card: what the owner's agent set, in the cockpit's words. */
export function settingChips(car: OwnerCarSettings | null | undefined): SettingChip[] {
  if (!car) return [];
  const out: SettingChip[] = [];
  if (typeof car.charge_limit_pct === "number") {
    const full = typeof car.full_pct === "number" ? car.full_pct : 100;
    out.push({
      key: "limit",
      label: `Max ${Math.round(car.charge_limit_pct)}% · your agent`,
      title: `Your agent set this car to charge to at most ${Math.round(car.charge_limit_pct)}% instead of ${Math.round(full)}%. It lifts when the demo run ends.`,
    });
  }
  if (car.hold_until_local) {
    out.push({
      key: "hold",
      label: `Held until ${car.hold_until_local.replace(/ sim time$/, "")}`,
      title: `Your agent asked OTTO-Q not to let this car leave before ${car.hold_until_local}. A hold only delays a departure; it never moves the car.`,
    });
  }
  for (const o of car.orders ?? []) {
    out.push({
      key: `order:${o.service}`,
      label: `${o.name ?? humanize(o.service)} · ${whenLabel(o.when)}`,
      title: "Ordered by your agent. OTTO-Q decides when and where, and the car does not leave with it undone.",
    });
  }
  return out;
}

export interface ReceiptText {
  /** The receipt's first line: "Done. All 36 Teslas charge to at most 90% instead of 100%." */
  head: string;
  /** Its grouped lines, without the dash: "12 are charging and will stop at 90%". */
  bullets: string[];
  /** Everything else, except the OrchestrAV link (the reader is already here). */
  notes: string[];
}

export function receiptText(summary: string | null | undefined): ReceiptText {
  const lines = (summary ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const [head = "", ...rest] = lines;
  return {
    head,
    bullets: rest.filter((l) => l.startsWith("- ")).map((l) => l.slice(2)),
    notes: rest.filter((l) => !l.startsWith("- ") && !/^See it in OrchestrAV:/i.test(l)),
  };
}

/** Where a command stands now, which can differ from its outcome when it was sent. */
export function commandState(c: Pick<OwnerCommand, "outcome" | "live_run" | "undone_at" | "lifted_at">): { label: string; tone: Tone; explain: string } {
  if (c.outcome === "refused") return { label: "Refused", tone: "bad", explain: "OTTO-Q did not apply it, and recorded why." };
  if (c.outcome === "no_change") return { label: "Nothing to change", tone: "muted", explain: "It was already so." };
  if (c.undone_at) return { label: "Undone", tone: "muted", explain: "Your agent undid it; what it replaced came back." };
  if (c.lifted_at || !c.live_run) {
    return { label: "Run ended", tone: "muted", explain: "Its run has ended, and a stop or reset of the twin lifts everything an agent set." };
  }
  return { label: "In force", tone: "good", explain: "OTTO-Q is applying it on the live run." };
}

export function toolLabel(tool: string): string {
  switch (tool) {
    case "set_charge_limit": return "Charge limit";
    case "clear_charge_limit": return "Charge limit cleared";
    case "request_service": return "Service ordered";
    case "cancel_service": return "Order withdrawn";
    case "hold_vehicle": return "Hold";
    case "release_hold": return "Hold released";
    case "undo_command": return "Undo";
    default: return humanize(tool);
  }
}

/** The cars a receipt names: from its cars, else from its effects. */
export function commandVehicleIds(c: OwnerCommand | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const v of c?.vehicles ?? []) if (v?.id) ids.add(v.id);
  if (ids.size === 0) for (const e of c?.effects ?? []) if (e?.vehicle_id) ids.add(e.vehicle_id);
  if (ids.size === 0) for (const id of c?.vehicle_ids ?? []) if (id) ids.add(id);
  return ids;
}

export interface InForceGroup {
  key: string;
  label: string;
  vehicles: string[];
  waitingForTick: boolean;
}

/** What is in force, one line per setting with the cars that carry it: "Max 90% · 36 cars". */
export function groupInForce(items: OwnerInForce[] | null | undefined): InForceGroup[] {
  const groups = new Map<string, InForceGroup>();
  for (const s of items ?? []) {
    const [key, label] =
      s.kind === "charge_limit" ? [`limit:${s.charge_limit_pct}`, `Charge to at most ${s.charge_limit_pct}%`]
      : s.kind === "hold" ? [`hold:${s.hold_until_sim}`, `Held until ${s.hold_until_local ?? "--"}`]
      : [`order:${s.service}:${s.when}`, `${s.service_name ?? humanize(s.service ?? "service")} · ${whenLabel(s.when)}`];
    const g = groups.get(key) ?? { key, label, vehicles: [], waitingForTick: false };
    g.vehicles.push(s.vehicle);
    g.waitingForTick = g.waitingForTick || !!s.waiting_for_tick;
    groups.set(key, g);
  }
  return [...groups.values()];
}
