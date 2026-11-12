// ============================================================================
// robots — the depot's machines, read from the twin's own feeds.
//
// Chase, 2026-11-09: "Pulse should have depot/operator level info on the functionality of the machines (not
// necessarily CAD-level, but functionality and facts). Orchestra needs just user/asset/vehicle owner detail from a
// stall or stage perspective. ... I think just the twin needs the CAD level detail."
//
// Three machines work at the twin depot. The twin's Robotics tab holds their engineering models; this file holds what
// a machine IS (./robotFacts.json, a verbatim copy of the twin's public/cad/robot-facts.json) and reads what each one
// is DOING from the snapshot the twin cockpit reads:
//
//   charge_arm   OTTO-CHARGE ARM, one at each fast charger. The engine publishes its hold on the car at each stall
//                (stalls_status: tethered, tether_direction, tether_phase), its open cycles with their retries
//                (arm.cycles), its timings and its results for the run (arm.timings, arm.accuracy).
//   clean_arm    OTTO-CLEAN ARM, one over each fast charger. The engine starts its cabin clean as the charge connects
//                (otto-q-core 0758, 0764, 0765) and publishes it on the car's visit: an interior_tidy atom with
//                performed_by 'stall_cabin_robot', the stall (robot_stall_id) and its times (started_at, ends_at).
//   wash_gantry  OTTO-WASH, one in each wash bay. The engine seats a car and times the work (0746) and publishes the
//                seat on the car (bay_seat: since, ends_at; 0762). It washes without a brush and dries. Then 2 robot arms polish the sensors. No door opens.
//
// Nothing here invents a state. A field the feed does not carry reads null. The moves inside a step (which side the
// arm is on, which pass the machine makes) stay in the twin, which draws them: a cockpit says the step and its times.
//
// Pure: no React, no fetch, no clock of its own. Every time is compared with the snapshot's sim clock.
// Kept file-for-file identical in OTTO-PULSE and OrchestrAV.
// ============================================================================
import factsJson from "./robotFacts.json";
import type { CardNeed, CardStep } from "./cards";
import { chargerNameFromCode, stallDownOf, type ChargerDown } from "./chargerFaults";
import type { FleetRow } from "./model";
import { placeName } from "./plainWords";
import type { TwinEventsWindow, TwinKpiBoard, TwinLayout, TwinSnapshot, TwinVisitAtom } from "./types";

// ── what each machine is ─────────────────────────────────────────────────────
export type MachineKey = "charge_arm" | "clean_arm" | "wash_gantry";
export const MACHINE_KEYS: readonly MachineKey[] = ["charge_arm", "clean_arm", "wash_gantry"];

export interface MachineStep { id: string; label: string; seconds: number | null; note?: string }
export interface MachineFact { label: string; value: string }
export interface MachineFacts {
  key: MachineKey;
  name: string;
  short: string;
  stallType: "dcfc" | "wash_bay";
  where: string;
  summary: string[];
  owner: string[];
  functions: string[];
  services: string[];
  steps: MachineStep[];
  facts: MachineFact[];
  safety: string[];
}
export interface RobotFacts {
  version: number;
  source: { repo: string; file: string; builtBy: string };
  chargeArm: { connectSeconds: number; releaseSeconds: number };
  machines: MachineFacts[];
}

/** The twin's facts file, as the twin built it. */
export const ROBOT_FACTS = factsJson as unknown as RobotFacts;

export function machineFacts(key: MachineKey): MachineFacts {
  const m = ROBOT_FACTS.machines.find((x) => x.key === key);
  if (!m) throw new Error(`robotFacts.json has no machine ${key}`);
  return m;
}

/** What a line of running text calls each machine: the twin's car card says "charge arm" and "cleaning arm". */
export const MACHINE_WORD: Record<MachineKey, string> = {
  charge_arm: "Charge arm",
  clean_arm: "Cleaning arm",
  wash_gantry: "Wash machine",
};

// ── clocks ───────────────────────────────────────────────────────────────────
const at = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** 0..100 through [from, to] at `now`; null when a time is missing or the window is empty. */
export function progressPct(from: string | null | undefined, to: string | null | undefined, now: string | null | undefined): number | null {
  const a = at(from), b = at(to), n = at(now);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(n) || b <= a) return null;
  return Math.max(0, Math.min(100, ((n - a) / (b - a)) * 100));
}

/** Whole minutes from `now` to `to`, rounded up, never below 0; null when a time is missing. */
export function minutesLeft(to: string | null | undefined, now: string | null | undefined): number | null {
  const b = at(to), n = at(now);
  if (!Number.isFinite(b) || !Number.isFinite(n)) return null;
  return Math.max(0, Math.ceil((b - n) / 60000));
}

// ── a need's state and who does it ───────────────────────────────────────────
export type WorkState = "done" | "active" | "open" | "dropped";
/** A need's status in four readings (the twin card's needState). Anything unknown is still owed. */
export function workState(status: string | null | undefined): WorkState {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "done": case "complete": case "completed": return "done";
    case "in_progress": case "active": return "active";
    case "cancelled": case "canceled": case "skipped": return "dropped";
    default: return "open";
  }
}

type NeedLike = { svc?: string | null; status?: string | null; performed_by?: string | null; robot_stall_id?: string | null };
/** The stall's cleaning arm does this need: performed_by on the cards, robot_stall_id too on the snapshot's atoms. */
export function byCleaningArm(n: NeedLike | null | undefined): boolean {
  return !!n && (n.performed_by === "stall_cabin_robot" || (typeof n.robot_stall_id === "string" && n.robot_stall_id !== ""));
}

/** Who did a need, as a chip says it beside the need's name; null for a technician (the twin card's words). */
export function performerWords(n: NeedLike | null | undefined): string | null {
  if (!n) return null;
  if (n.performed_by === "charger_sensors") return "by the charger's sensors";
  if (byCleaningArm(n)) return "by the stall's cleaning arm";
  return null;
}

// ── the live board ───────────────────────────────────────────────────────────
export type ChargeArmState = "home" | "connecting" | "connected" | "releasing" | "down";
export type CleanArmState = "home" | "cleaning" | "done" | "down";
export type PostState = "free" | "held" | "in_use" | "down";

export interface PostRow {
  stallId: string;
  code: string;
  /** "DCFC-07", the name the twin's plan draws */
  name: string;
  canopy: string | null;
  connectorKw: number | null;
  state: PostState;
  vehicleId: string | null;
  /** null when the car is outside this cockpit's scope: an owner reads only its own cars by name */
  vehicleName: string | null;
  operatorName: string | null;
  heldForName: string | null;
  heldUntil: string | null;
  down: ChargerDown | null;
  charge: {
    state: ChargeArmState;
    /** the engine's phase name (unstow, approach, align, insert, latch, charging, unlatch, extract, retract), or null */
    phase: string | null;
    /** that phase in the twin's words ("Align with the cameras"), or null */
    step: string | null;
    retry: number;
    /** when the engine expects this phase to end; null while the arm is connected (the charge sets that end) */
    until: string | null;
  };
  clean: {
    state: CleanArmState;
    startedAt: string | null;
    endsAt: string | null;
    doneAt: string | null;
    progress: number | null;
    minutesLeft: number | null;
  };
}

export type BayState = "free" | "held" | "in_use" | "washing" | "detailing" | "down";
export interface BayRow {
  stallId: string;
  code: string;
  /** "wash bay 01" */
  name: string;
  state: BayState;
  vehicleId: string | null;
  vehicleName: string | null;
  operatorName: string | null;
  heldForName: string | null;
  heldUntil: string | null;
  down: ChargerDown | null;
  since: string | null;
  endsAt: string | null;
  progress: number | null;
  minutesLeft: number | null;
  /** the seat's timer has run out and the twin has not moved the car on yet (it does on its next tick) */
  finished: boolean;
}

export interface RobotBoard {
  simClock: string | null;
  posts: PostRow[];
  bays: BayRow[];
  counts: {
    chargeArms: { total: number; connecting: number; connected: number; releasing: number; home: number; down: number };
    /** `home` includes an arm that has finished its car */
    cleanArms: { total: number; cleaning: number; home: number; down: number };
    /** `idle` includes a machine whose seat has just ended, and a bay a car stands in with no seat published */
    washMachines: { total: number; running: number; idle: number; down: number };
  };
}

const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code, "en", { numeric: true });

/** The charge arm's step in the twin's words, from the facts file's own step list. */
export function chargeStepWords(phase: string | null | undefined): string | null {
  if (!phase) return null;
  return machineFacts("charge_arm").steps.find((s) => s.id === phase)?.label ?? null;
}

/**
 * Every fast charger's two arms and every wash bay's machine, as the snapshot has them now.
 * `fleet` names the cars (joinFleet): a car outside it keeps its id and loses its name, so an owner's projection never
 * prints another owner's car.
 */
export function robotBoard(
  layout: TwinLayout | null | undefined,
  snapshot: TwinSnapshot | null | undefined,
  fleet: FleetRow[],
): RobotBoard {
  const simClock = snapshot?.run?.sim_clock ?? null;
  const rowById = new Map(fleet.map((r) => [r.id, r]));
  const statusById = new Map((snapshot?.stalls_status ?? []).map((s) => [String(s.id), s]));
  const vehicles = snapshot?.fleet?.vehicles ?? [];
  const carOnStall = new Map<string, (typeof vehicles)[number]>();
  for (const v of vehicles) if (v.stall_id && !carOnStall.has(v.stall_id)) carOnStall.set(v.stall_id, v);
  const cycleByStall = new Map((snapshot?.arm?.cycles ?? []).map((c) => [String(c.stall_id), c]));

  // the cleaning arms' work, by the stall that does it: a clean under way wins over a finished one
  const cleanByStall = new Map<string, { vehicleId: string; atom: TwinVisitAtom; state: WorkState }>();
  for (const v of vehicles) {
    for (const a of v.visit?.atoms ?? []) {
      // the arm's deep program (otto-q-core 0815) is an interior deep clean with the same fields
      if ((a.svc !== "interior_tidy" && a.svc !== "interior_deep_clean") || !byCleaningArm(a) || !a.robot_stall_id) continue;
      const state = workState(a.status);
      if (state !== "active" && state !== "done") continue;
      // a finished clean is this stall's news only while its car still stands there
      if (state === "done" && v.stall_id !== a.robot_stall_id) continue;
      const had = cleanByStall.get(a.robot_stall_id);
      if (!had || (had.state !== "active" && state === "active")) cleanByStall.set(a.robot_stall_id, { vehicleId: v.id, atom: a, state });
    }
  }

  const name = (id: string | null | undefined) => (id ? rowById.get(id)?.name ?? null : null);
  const owner = (id: string | null | undefined) => (id ? rowById.get(id)?.operatorName ?? null : null);

  const posts: PostRow[] = (layout?.stalls ?? []).filter((s) => s.type === "dcfc").sort(byCode).map((st) => {
    const ss = statusById.get(String(st.id)) ?? null;
    const down = stallDownOf(ss);
    const cycle = cycleByStall.get(String(st.id)) ?? null;
    const clean = cleanByStall.get(String(st.id)) ?? null;
    const vehicleId = str(ss?.vehicle_id) ?? str(cycle?.vehicle_id) ?? carOnStall.get(String(st.id))?.id ?? clean?.vehicleId ?? null;
    const heldFor = !vehicleId ? str(ss?.reserved_by) : null;

    let charge: PostRow["charge"] = { state: "home", phase: null, step: null, retry: 0, until: null };
    if (down) {
      charge = { ...charge, state: "down" };
    } else if (cycle) {
      // an open cycle is the arm reaching in or pulling out; it carries the retry the stall row does not
      const phase = str(cycle.phase) ?? str(ss?.tether_phase);
      charge = {
        state: cycle.direction === "demate" ? "releasing" : "connecting",
        phase, step: chargeStepWords(phase), retry: Number(cycle.retry_count) > 0 ? Number(cycle.retry_count) : 0,
        until: str(cycle.phase_deadline) ?? str(ss?.tether_until),
      };
    } else if (ss?.tethered) {
      // no direction on an older backend: every hold was a release then
      const dir = str(ss.tether_direction) ?? "demate";
      const phase = str(ss.tether_phase);
      charge = {
        state: dir === "mate" ? "connecting" : dir === "charging" ? "connected" : "releasing",
        // through the charge the hold is a lease the engine renews (120 s at a time): its end is not the charge's end
        phase, step: chargeStepWords(phase), retry: 0, until: dir === "charging" ? null : str(ss.tether_until),
      };
    }

    let cleanOut: PostRow["clean"] = { state: down ? "down" : "home", startedAt: null, endsAt: null, doneAt: null, progress: null, minutesLeft: null };
    if (!down && clean) {
      const startedAt = str(clean.atom.started_at), endsAt = str(clean.atom.ends_at);
      cleanOut = clean.state === "active"
        ? { state: "cleaning", startedAt, endsAt, doneAt: null, progress: progressPct(startedAt, endsAt, simClock), minutesLeft: minutesLeft(endsAt, simClock) }
        : { state: "done", startedAt, endsAt, doneAt: str(clean.atom.done_at), progress: null, minutesLeft: null };
    }

    return {
      stallId: String(st.id), code: st.code, name: chargerNameFromCode(st.code, "dcfc") ?? st.code,
      canopy: st.canopy ?? null, connectorKw: st.connector_kw ?? null,
      // a charger whose arm still holds a car is in use, even when the feed no longer says which car
      state: down ? "down" : vehicleId || ss?.tethered === true ? "in_use" : heldFor ? "held" : "free",
      vehicleId, vehicleName: name(vehicleId), operatorName: owner(vehicleId),
      heldForName: name(heldFor), heldUntil: heldFor ? str(ss?.reserved_until) : null,
      down, charge, clean: cleanOut,
    };
  });

  const bays: BayRow[] = (layout?.stalls ?? []).filter((s) => s.type === "wash_bay").sort(byCode).map((st) => {
    const ss = statusById.get(String(st.id)) ?? null;
    const down = stallDownOf(ss);
    const car = carOnStall.get(String(st.id)) ?? null;
    const vehicleId = car?.id ?? str(ss?.vehicle_id);
    const heldFor = !vehicleId ? str(ss?.reserved_by) : null;
    const seated = car && (car.state === "in_wash_bay" || car.state === "in_detail_bay") ? car : null;
    const since = str(seated?.bay_seat?.since), endsAt = str(seated?.bay_seat?.ends_at);
    const end = at(endsAt), now = at(simClock);
    return {
      stallId: String(st.id), code: st.code, name: placeName(st.code, "wash_bay"),
      state: down ? "down" : seated ? (seated.state === "in_detail_bay" ? "detailing" : "washing") : vehicleId ? "in_use" : heldFor ? "held" : "free",
      vehicleId, vehicleName: name(vehicleId), operatorName: owner(vehicleId),
      heldForName: name(heldFor), heldUntil: heldFor ? str(ss?.reserved_until) : null,
      down,
      since, endsAt,
      progress: seated ? progressPct(since, endsAt, simClock) : null,
      minutesLeft: seated ? minutesLeft(endsAt, simClock) : null,
      finished: !!seated && Number.isFinite(end) && Number.isFinite(now) && now >= end,
    };
  });

  const n = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
  // a seat whose timer has run out is a machine that has finished: the car leaves on the twin's next tick
  const atWork = (b: BayRow) => (b.state === "washing" || b.state === "detailing") && !b.finished;
  return {
    simClock, posts, bays,
    counts: {
      chargeArms: {
        total: posts.length,
        connecting: n(posts, (p) => p.charge.state === "connecting"),
        connected: n(posts, (p) => p.charge.state === "connected"),
        releasing: n(posts, (p) => p.charge.state === "releasing"),
        home: n(posts, (p) => p.charge.state === "home"),
        down: n(posts, (p) => p.charge.state === "down"),
      },
      cleanArms: {
        total: posts.length,
        cleaning: n(posts, (p) => p.clean.state === "cleaning"),
        home: n(posts, (p) => p.clean.state === "home" || p.clean.state === "done"),
        down: n(posts, (p) => p.clean.state === "down"),
      },
      washMachines: {
        total: bays.length,
        running: n(bays, atWork),
        idle: n(bays, (b) => b.state !== "down" && !atWork(b)),
        down: n(bays, (b) => b.state === "down"),
      },
    },
  };
}

/**
 * One machine kind's state in a line, for a summary tile: "21/30" "on a car", "20 connected · 1 connecting · 3 down".
 * With no live run it says how many the depot has, and that no run is live: a count of idle arms would read as a
 * measurement.
 */
export function machineHeadline(key: MachineKey, board: RobotBoard, live: boolean): { value: string; unit: string; sub: string } {
  const c = board.counts;
  const parts = (...xs: (string | false | 0)[]) => xs.filter(Boolean).join(" · ");
  if (key === "charge_arm") {
    const a = c.chargeArms;
    if (!live) return { value: String(a.total), unit: "at the depot", sub: "no live run" };
    return {
      value: `${a.connecting + a.connected + a.releasing}/${a.total}`, unit: "on a car",
      sub: parts(`${a.connected} connected`, a.connecting > 0 && `${a.connecting} connecting`, a.releasing > 0 && `${a.releasing} releasing`, a.down > 0 && `${a.down} down`),
    };
  }
  if (key === "clean_arm") {
    const a = c.cleanArms;
    if (!live) return { value: String(a.total), unit: "at the depot", sub: "no live run" };
    return { value: `${a.cleaning}/${a.total}`, unit: "cleaning", sub: parts(`${a.home} home`, a.down > 0 && `${a.down} down`) };
  }
  const a = c.washMachines;
  if (!live) return { value: String(a.total), unit: "at the depot", sub: "no live run" };
  return { value: `${a.running}/${a.total}`, unit: "running", sub: parts(`${a.idle} idle`, a.down > 0 && `${a.down} down`) };
}

// ── the run so far ───────────────────────────────────────────────────────────
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface ChargeArmRun {
  /** first reaches plus retries; 0 with null statistics means nothing was measured, never a perfect score */
  attempts: number;
  cycles: number | null;
  latched: number | null;
  retried: number | null;
  restageRequired: number | null;
  firstPassPct: number | null;
  portSeenPct: number | null;
  errorMmP50: number | null;
  errorMmP95: number | null;
  errorMmMax: number | null;
  tolerance: { lateralMm: number | null; verticalMm: number | null; yawDeg: number | null } | null;
  /** from the run's events: null when the events window has not answered */
  connectsStarted: number | null;
  connected: number | null;
  released: number | null;
  /** a charger fault made the arm let its car go at once */
  emergencyReleases: number | null;
  /** seconds of arm motion to connect and to release: the engine's own, else null (the facts file holds the defaults) */
  connectSeconds: number | null;
  releaseSeconds: number | null;
}

/** The charge arms' results for the run, from the snapshot's arm block and the run's event counts. */
export function chargeArmRun(snapshot: TwinSnapshot | null | undefined, events: TwinEventsWindow | null | undefined): ChargeArmRun {
  const acc = snapshot?.arm?.accuracy ?? null;
  const t = snapshot?.arm?.timings ?? null;
  const by = events?.by_type ?? null;
  const count = (k: string): number | null => (by ? num(by[k]) ?? 0 : null);
  return {
    attempts: num(acc?.attempts) ?? 0,
    cycles: num(acc?.cycles), latched: num(acc?.latched), retried: num(acc?.retried),
    restageRequired: num(acc?.restage_required),
    firstPassPct: num(acc?.first_pass_yield_pct), portSeenPct: num(acc?.fiducial_seen_pct),
    errorMmP50: num(acc?.error_radial_mm_p50), errorMmP95: num(acc?.error_radial_mm_p95), errorMmMax: num(acc?.error_radial_mm_max),
    tolerance: acc?.tolerance
      ? { lateralMm: num(acc.tolerance.lateral_mm), verticalMm: num(acc.tolerance.vertical_mm), yawDeg: num(acc.tolerance.yaw_deg) }
      : null,
    connectsStarted: count("arm.mate_started"), connected: count("arm.mate_latched"),
    released: count("arm.demate_cleared"), emergencyReleases: count("arm.emergency_release"),
    connectSeconds: num(t?.connect_seconds), releaseSeconds: num(t?.demate_seconds),
  };
}

export interface ServiceRun { svc: string; name: string; done: number; total: number }

/**
 * One service's count for the run from the KPI board (ottoq_twin_kpi_board, service.by_service), or null when the
 * board has not answered or does not list it. The board counts the service, whoever did it: a technician's interior
 * tidy counts beside the arms'.
 */
export function serviceRun(kpi: TwinKpiBoard | null | undefined, svc: string): ServiceRun | null {
  const row = kpi?.ok ? kpi.service?.by_service?.find((s) => s.svc === svc) : null;
  if (!row) return null;
  return { svc: row.svc, name: row.name, done: Number(row.done) || 0, total: Number(row.total) || 0 };
}

// ── one car's machines ───────────────────────────────────────────────────────
export interface MachineLine {
  machine: MachineKey;
  /** "Charge arm" · "Cabin clean" · "Robotic wash" · "Robotic detail" (the twin card's titles) */
  title: string;
  /** what the machine does to the car now, in the twin card's words */
  words: string;
  state: "working" | "done";
  /** 0..100 through the step at the snapshot's clock; null when done or when a time is missing */
  progress: number | null;
  startedAt: string | null;
  endsAt: string | null;
  doneAt: string | null;
}

const ARM_VERB: Record<string, string> = { mate: "connects", demate: "disconnects", charging: "connected" };

/**
 * What the depot's machines are doing to one car, or did on this visit: the charge arm while it holds the car, the
 * stall's cleaning arm's cabin clean (under way, then done), and the wash bay's machine while the car is seated.
 * Reads the car's own records only: its open arm cycle or its stall's hold, its visit's needs, its bay seat.
 */
export function vehicleMachines(
  row: Pick<FleetRow, "id" | "state" | "visit" | "card">,
  snapshot: TwinSnapshot | null | undefined,
): MachineLine[] {
  const out: MachineLine[] = [];
  const simClock = snapshot?.run?.sim_clock ?? null;
  const sv = snapshot?.fleet?.vehicles?.find((v) => v.id === row.id) ?? null;

  // ── charge arm: the car's open cycle, else its stall's hold while the charge runs ──
  const cycle = (snapshot?.arm?.cycles ?? []).find((c) => c.vehicle_id === row.id) ?? null;
  if (cycle) {
    const retry = Number(cycle.retry_count) > 0 ? ` (retry ${cycle.retry_count})` : "";
    out.push({
      machine: "charge_arm", title: MACHINE_WORD.charge_arm, words: `${ARM_VERB[cycle.direction] ?? cycle.direction.replace(/_/g, " ")}${retry}`,
      state: "working", progress: null, startedAt: str(cycle.started_at), endsAt: str(cycle.phase_deadline), doneAt: null,
    });
  } else if (sv?.stall_id) {
    const ss = (snapshot?.stalls_status ?? []).find((s) => String(s.id) === sv.stall_id) ?? null;
    if (ss?.tethered && !stallDownOf(ss) && (!ss.vehicle_id || ss.vehicle_id === row.id)) {
      const dir = str(ss.tether_direction) ?? "demate";
      out.push({
        machine: "charge_arm", title: MACHINE_WORD.charge_arm, words: ARM_VERB[dir] ?? dir.replace(/_/g, " "),
        state: "working", progress: null, startedAt: null, endsAt: dir === "charging" ? null : str(ss.tether_until), doneAt: null,
      });
    }
  }

  // ── cleaning arm: the visit's interior tidy, when the stall's arm does it ──
  const atoms = row.visit?.atoms ?? [];
  const needs = row.card?.needs ?? [];
  const tidy: (NeedLike & { started_at?: string | null; ends_at?: string | null; done_at?: string | null }) | undefined =
    atoms.find((a) => a.svc === "interior_tidy" && byCleaningArm(a) && workState(a.status) !== "dropped")
    ?? needs.find((nd) => nd.svc === "interior_tidy" && byCleaningArm(nd) && workState(nd.status) !== "dropped");
  if (tidy) {
    // the snapshot's atom and the card's need are the same record: either may carry the times
    const twin = atoms.find((a) => a.svc === "interior_tidy" && byCleaningArm(a)) ?? null;
    const card = needs.find((nd) => nd.svc === "interior_tidy" && byCleaningArm(nd)) ?? null;
    const startedAt = str(tidy.started_at) ?? str(twin?.started_at) ?? str(card?.started_at);
    const endsAt = str(tidy.ends_at) ?? str(twin?.ends_at) ?? str(card?.ends_at);
    const st = workState(tidy.status);
    if (st === "done") {
      out.push({
        machine: "clean_arm", title: "Cabin clean", words: "Done.", state: "done", progress: null,
        startedAt, endsAt, doneAt: str(tidy.done_at) ?? str(twin?.done_at) ?? str(card?.done_at),
      });
    } else if (st === "active") {
      out.push({
        machine: "clean_arm", title: "Cabin clean", words: "The arm cleans the cabin.", state: "working",
        progress: progressPct(startedAt, endsAt, simClock), startedAt, endsAt, doneAt: null,
      });
    }
  }

  // ── wash machine: the car's seat in a wash bay ──
  const state = sv?.state ?? row.state;
  if (state === "in_wash_bay" || state === "in_detail_bay") {
    const interior = state === "in_detail_bay";
    const since = str(sv?.bay_seat?.since), endsAt = str(sv?.bay_seat?.ends_at);
    const end = at(endsAt), now = at(simClock);
    const finished = Number.isFinite(end) && Number.isFinite(now) && now >= end;
    out.push({
      machine: "wash_gantry", title: interior ? "Robotic detail" : "Robotic wash",
      words: finished ? "Done. The car can leave."
        : interior ? "The machine washes the car. Then 2 robot arms polish its sensors. The doors stay shut." : "The machine washes the car. Then 2 robot arms polish its sensors.",
      state: finished ? "done" : "working",
      progress: progressPct(since, endsAt, simClock), startedAt: since, endsAt, doneAt: finished ? endsAt : null,
    });
  }
  return out;
}

/**
 * Every car's machine lines, and which cars each machine is at work on now. One pass over the cars in scope: an
 * owner's cockpit passes its own cars and counts only those.
 */
export function machinesByCar(
  rows: readonly Pick<FleetRow, "id" | "state" | "visit" | "card">[],
  snapshot: TwinSnapshot | null | undefined,
): { lines: Map<string, MachineLine[]>; working: Record<MachineKey, string[]> } {
  const lines = new Map<string, MachineLine[]>();
  const working: Record<MachineKey, string[]> = { charge_arm: [], clean_arm: [], wash_gantry: [] };
  for (const r of rows) {
    const ls = vehicleMachines(r, snapshot);
    if (!ls.length) continue;
    lines.set(r.id, ls);
    for (const k of MACHINE_KEYS) if (ls.some((l) => l.machine === k && l.state === "working")) working[k].push(r.id);
  }
  return { lines, working };
}

// ── a plan's stages ──────────────────────────────────────────────────────────
/**
 * The machine that does a step of a car's plan, or null when a technician or no machine does.
 *   a fast charge            the charge arm (every fast charger at the twin depot has one)
 *   an interior tidy         the cleaning arm, only when the visit's tidy is the arm's (`needs`)
 *   a wash or a detail       the wash bay's machine (run a0001fd6: all 59 done wash and detail legs went to a wash bay)
 */
export function stepMachine(
  step: Pick<CardStep, "leg_type" | "atom"> & { to_stall_kind?: string | null },
  needs?: readonly Pick<CardNeed, "svc" | "status" | "performed_by">[] | null,
): MachineKey | null {
  const leg = step.leg_type;
  if (leg === "charge_dcfc") return "charge_arm";
  if (leg === "interior_tidy" || step.atom === "interior_tidy") {
    return (needs ?? []).some((nd) => nd.svc === "interior_tidy" && byCleaningArm(nd)) ? "clean_arm" : null;
  }
  if (leg === "wash" || leg === "detail") return !step.to_stall_kind || step.to_stall_kind === "wash" ? "wash_gantry" : null;
  return null;
}

/** The charger's own sensors do this step (an interior inspection, a triage check): the visit's need says so. */
export function stepBySensors(
  step: Pick<CardStep, "leg_type" | "atom">,
  needs?: readonly Pick<CardNeed, "svc" | "performed_by">[] | null,
): boolean {
  const svc = step.atom ?? step.leg_type;
  return (needs ?? []).some((nd) => nd.svc === svc && nd.performed_by === "charger_sensors");
}

/** What a stage's tag says the machine does: the arm connects the car (the charger charges it), the others do the work. */
const STAGE_TAG: Record<MachineKey, string> = {
  charge_arm: "the charge arm connects the car",
  clean_arm: "by the cleaning arm",
  wash_gantry: "by the wash machine",
};
export function byMachineWords(key: MachineKey): string {
  return STAGE_TAG[key];
}

/** A step of the card's plan, or work under way that the plan's steps do not list (read from the visit's needs). */
export type PlanStep = CardStep & { fromNeed?: boolean };

/** The leg type the engine plans a service under, where it is not the service's own name (run a0001fd6's legs). */
const SVC_LEG: Record<string, string> = {
  exterior_wash: "wash",
  interior_deep_clean: "detail",
  interior_inspection: "inspect",
  readiness_check: "inspect",
  mechanical_pm: "service",
  sensor_calibration: "service",
  fault_repair: "service",
};
/** The service a wash bay's leg is for, when the leg does not name it. */
const LEG_SVC: Record<string, string> = { wash: "exterior_wash", detail: "interior_deep_clean" };
const sameInstant = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = at(a), y = at(b);
  return Number.isFinite(x) && x === y;
};
type NeedTimes = NeedLike & { started_at?: string | null; ends_at?: string | null };

/**
 * A car's visit as its stages, in order: done, under way, to come.
 *   - Travel between stations is left out.
 *   - A planning record that never ran is left out. When the stall's arm takes a tidy, the engine closes the planned
 *     leg with no duration and writes the arm's own beside it (run a0001fd6: 6 itineraries hold both for one tidy).
 *   - Work under way that the steps do not list is added from the visit's needs, at the car's present station. The
 *     card's steps hold ONE step under way (the first active leg), so a cabin clean that runs during the charge is
 *     not among them until it is done.
 */
export function planStages(
  steps: readonly CardStep[] | null | undefined,
  needs?: readonly NeedTimes[] | null,
  here?: { code: string | null; kind: string | null } | null,
): PlanStep[] {
  const base = (steps ?? []).filter((s) => s.leg_type !== "taxi");
  const neverRan = (s: CardStep) => s.status === "done" && sameInstant(s.actual_start, s.actual_end);
  const sameWork = (a: CardStep, b: CardStep) =>
    a.leg_type === b.leg_type && (a.atom ?? null) === (b.atom ?? null) && (a.to_stall_code ?? null) === (b.to_stall_code ?? null);
  const kept: PlanStep[] = base.filter((s) => !(neverRan(s) && base.some((o) => o !== s && sameWork(o, s) && !neverRan(o))));

  const svcOf = (s: CardStep) => s.atom ?? LEG_SVC[s.leg_type] ?? s.leg_type;
  const under: PlanStep[] = [];
  for (const nd of needs ?? []) {
    if (!nd.svc || nd.svc === "charge" || workState(nd.status) !== "active") continue;
    if (kept.some((s) => s.status === "current" && svcOf(s) === nd.svc)) continue;
    // the two feeds are polled apart: a need that still reads under way while its own leg already reads done (the
    // same start) is that finished stage, not a second one
    if (kept.some((s) => s.status === "done" && svcOf(s) === nd.svc && sameInstant(s.actual_start, nd.started_at))) continue;
    if (under.some((u) => u.atom === nd.svc)) continue;
    under.push({
      seq: -1 - under.length, leg_type: SVC_LEG[nd.svc] ?? nd.svc, atom: nd.svc, status: "current",
      planned_start: null, planned_end: null, actual_start: str(nd.started_at), expected_end: str(nd.ends_at), eta_source: "plan",
      to_stall_code: here?.code ?? null, to_stall_kind: here?.kind ?? null, fromNeed: true,
    });
  }
  if (!under.length) return kept;
  // after the step under way, else after the last finished one: before everything still to come
  let i = kept.length;
  while (i > 0 && kept[i - 1].status === "upcoming") i -= 1;
  return [...kept.slice(0, i), ...under, ...kept.slice(i)];
}
