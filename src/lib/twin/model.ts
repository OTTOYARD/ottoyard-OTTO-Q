// ============================================================================
// Pure view-model functions: twin feeds in, rows to draw out.
//
// No I/O, no clocks of their own, no invented values. Every number on screen
// comes from a feed; when a feed does not carry something the result is null
// and the UI must say so. Tested against real captures in __tests__.
// ============================================================================
import type { TwinFleetCondition, TwinLayout, TwinSnapshot, TwinVehicleCondition, TwinVisitCard } from "./types";
import type { ActivityRow, CardDecision, CardVehicle, DepotCardsResponse, DepotReservation } from "./cards";
import { describeDecision, type DecisionText } from "./decisionText";

// ── vehicle_state enum → stage ───────────────────────────────────────────────
// VERBATIM from the twin cockpit (ottoyarddepot-sim src/lib/ottoq/channels.ts
// STATE_TO_STAGE), which is the live pg_enum. A new enum value lands in
// "unknown" and is shown as its raw name, never silently re-filed.
export type Stage =
  | "off_site" | "inbound" | "at_gate" | "queued" | "charging" | "servicing"
  | "staged" | "departing" | "out_of_service" | "unknown";

const STATE_TO_STAGE: Record<string, Stage> = {
  offline: "off_site",
  deployed: "off_site",
  en_route_to_deployment: "departing",
  en_route_to_depot: "inbound",
  arrived_at_gate: "at_gate",
  staged_awaiting_service: "queued",
  charging_dcfc: "charging",
  charging_l2: "charging",
  in_wash_bay: "servicing",
  in_detail_bay: "servicing",
  in_service_bay: "servicing",
  charge_complete_holding: "staged",
  service_complete_holding: "staged",
  staged_for_departure: "staged",
  emergency_staged: "out_of_service",
  tow_requested: "out_of_service",
  out_of_service: "out_of_service",
};

export const STAGE_ORDER: Stage[] = [
  "inbound", "at_gate", "queued", "charging", "servicing", "staged", "departing", "off_site", "out_of_service", "unknown",
];

export const STAGE_LABEL: Record<Stage, string> = {
  inbound: "Inbound",
  at_gate: "At gate",
  queued: "Queued for service",
  charging: "Charging",
  servicing: "In service bay",
  staged: "Staged",
  departing: "Departing",
  off_site: "Off site",
  out_of_service: "Out of service",
  unknown: "Unmapped state",
};

export function stageOf(state: string | null | undefined): Stage {
  if (!state) return "unknown";
  return STATE_TO_STAGE[String(state).trim().toLowerCase()] ?? "unknown";
}

/** "charging_dcfc" → "Charging dcfc". Raw enum text, humanised, never re-worded. */
export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const t = String(s).replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── clocks ───────────────────────────────────────────────────────────────────
/** The depot is in Nashville. Sim timestamps are shown on the depot's own clock. */
export function simTime(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
}

/** Minutes from `from` to `to` (sim clock), rounded. null if either is missing. */
export function minutesBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

// ── one joined row per vehicle ───────────────────────────────────────────────
export interface FleetRow {
  id: string;
  name: string;
  oem: string | null;
  model: string | null;
  operatorId: string | null;
  operatorName: string | null;
  state: string;
  stage: Stage;
  soc: number | null;
  targetSoc: number | null;
  stallCode: string | null;
  stallKind: string | null;
  /** OTTO-Q's open visit as the twin publishes it (atoms, est charge min). undefined = snapshot not loaded. */
  visit: TwinVisitCard | null | undefined;
  card: CardVehicle["card"];
  reservations: CardVehicle["reservations"];
  lastDecision: CardVehicle["last_decision"];
  /** Twin variables dealt to this vehicle at run boot (seeded draw). null = not drawn for this run. */
  condition: TwinVehicleCondition | null;
}

/**
 * Join the three per-vehicle feeds on vehicle id.
 * `cards` is the spine (it carries operator + the operator filter);
 * the snapshot adds the live visit; fleet condition adds the twin's variables.
 * A vehicle the snapshot does not carry keeps visit = undefined (not "no visit").
 */
export function joinFleet(
  cards: DepotCardsResponse | null | undefined,
  snapshot: TwinSnapshot | null | undefined,
  condition: TwinFleetCondition | null | undefined,
): FleetRow[] {
  if (!cards) return [];
  const snapById = new Map((snapshot?.fleet?.vehicles ?? []).map((v) => [v.id, v]));
  const condOk = condition?.drawn_for_this_run === true;
  const condById = new Map((condOk ? condition!.vehicles : []).map((c) => [c.vehicle_id, c]));
  return cards.vehicles.map((v) => {
    const sv = snapById.get(v.vehicle_id);
    return {
      id: v.vehicle_id,
      name: v.display_name,
      oem: v.oem,
      model: v.model,
      operatorId: v.operator?.id ?? null,
      operatorName: v.operator?.name ?? null,
      state: v.state,
      stage: stageOf(v.state),
      soc: v.soc,
      targetSoc: v.target_soc,
      stallCode: v.stall?.code ?? null,
      stallKind: v.stall?.kind ?? null,
      visit: snapshot ? (sv ? sv.visit ?? null : undefined) : undefined,
      card: v.card,
      reservations: v.reservations ?? [],
      lastDecision: v.last_decision ?? null,
      condition: condById.get(v.vehicle_id) ?? null,
    };
  });
}

export function countByStage(rows: FleetRow[]): Record<Stage, number> {
  const out = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) out[r.stage] += 1;
  return out;
}

/** Vehicles holding more than one ACTIVE reservation at once. Surfaced, not hidden. */
export function doubleBooked(rows: FleetRow[]): FleetRow[] {
  return rows.filter((r) => r.reservations.filter((b) => b.state === "active").length > 1);
}

export function operatorsOf(cards: DepotCardsResponse | null | undefined): { id: string; name: string; count: number }[] {
  const m = new Map<string, { id: string; name: string; count: number }>();
  for (const v of cards?.vehicles ?? []) {
    const id = v.operator?.id;
    if (!id) continue;
    const e = m.get(id) ?? { id, name: v.operator?.name ?? id, count: 0 };
    e.count += 1;
    m.set(id, e);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── stalls ───────────────────────────────────────────────────────────────────
export interface StallRow {
  id: string;
  code: string;
  type: string;
  zone: string | null;
  connectorKw: number | null;
  /** 'occupied' | 'reserved' | 'available'. 'available' for a stall absent from stalls_status is
   *  the snapshot's own convention (it only publishes non-available stalls). */
  status: "occupied" | "reserved" | "available";
  vehicleName: string | null;
  reservedForName: string | null;
  reservedUntil: string | null;
  armPhase: string | null;
}

export interface StallTypeSummary {
  type: string;
  total: number;
  occupied: number;
  reserved: number;
  available: number;
}

export function stallBoard(
  layout: TwinLayout | null | undefined,
  snapshot: TwinSnapshot | null | undefined,
  fleet: FleetRow[],
): { stalls: StallRow[]; byType: StallTypeSummary[] } {
  if (!layout) return { stalls: [], byType: [] };
  const nameById = new Map(fleet.map((r) => [r.id, r.name]));
  const statusById = new Map((snapshot?.stalls_status ?? []).map((s) => [s.id, s]));
  const stalls: StallRow[] = layout.stalls.map((st) => {
    const s = statusById.get(st.id);
    const occupied = !!s && (s.status === "occupied" || !!s.vehicle_id);
    const reservedBy = s?.reserved_by ?? null;
    return {
      id: st.id,
      code: st.code,
      type: st.type,
      zone: st.zone,
      connectorKw: st.connector_kw,
      status: occupied ? "occupied" : reservedBy ? "reserved" : "available",
      vehicleName: s?.vehicle_id ? nameById.get(s.vehicle_id) ?? null : null,
      reservedForName: reservedBy ? nameById.get(reservedBy) ?? null : null,
      reservedUntil: s?.reserved_until ?? null,
      armPhase: s?.tether_phase ?? null,
    };
  });
  const m = new Map<string, StallTypeSummary>();
  for (const s of stalls) {
    const e = m.get(s.type) ?? { type: s.type, total: 0, occupied: 0, reserved: 0, available: 0 };
    e.total += 1;
    e[s.status] += 1;
    m.set(s.type, e);
  }
  return { stalls, byType: [...m.values()].sort((a, b) => b.total - a.total) };
}

// ── reservations ─────────────────────────────────────────────────────────────
/** The depot board is the union of every vehicle's held/active reservations, soonest first. */
export function allReservations(rows: FleetRow[]): DepotReservation[] {
  const out: DepotReservation[] = [];
  for (const r of rows) {
    for (const b of r.reservations) out.push({ ...b, vehicle_id: r.id, display_name: r.name, operator: r.operatorName });
  }
  return out.sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "") || a.display_name.localeCompare(b.display_name));
}

export function reservationsByPurpose(res: DepotReservation[] | undefined): { purpose: string; held: number; active: number }[] {
  const m = new Map<string, { purpose: string; held: number; active: number }>();
  for (const r of res ?? []) {
    const e = m.get(r.purpose) ?? { purpose: r.purpose, held: 0, active: 0 };
    if (r.state === "active") e.active += 1;
    else e.held += 1;
    m.set(r.purpose, e);
  }
  return [...m.values()].sort((a, b) => b.held + b.active - (a.held + a.active));
}

// ── energy ───────────────────────────────────────────────────────────────────
export interface EnergyView {
  at: string | null;
  /** sim-minutes between the energy row and the run clock; the feed is a LATEST row and can lag. */
  lagMin: number | null;
  gridImportKw: number | null;
  gridExportKw: number | null;
  evChargingKw: number | null;
  buildingKw: number | null;
  solarKw: number | null;
  bessOutputKw: number | null;
  peak15Kw: number | null;
  tariff: string | null;
  ratePerKwh: number | null;
  bessSocPct: number | null;
  bessState: string | null;
  bessTempC: number | null;
  bessPowerKw: number | null;
  drActive: boolean | null;
  drCapKw: number | null;
  lmpUsdMwh: number | null;
  carbonGPerKwh: number | null;
  tempC: number | null;
  conditions: string | null;
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const s = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

export function energyView(snapshot: TwinSnapshot | null | undefined): EnergyView | null {
  if (!snapshot) return null;
  const e = snapshot.energy ?? {};
  const b = snapshot.bess ?? {};
  const g = snapshot.grid ?? {};
  const w = snapshot.weather ?? {};
  const at = s(e.at);
  return {
    at,
    lagMin: minutesBetween(at, snapshot.run?.sim_clock),
    gridImportKw: n(e.grid_import_kw),
    gridExportKw: n(e.grid_export_kw),
    evChargingKw: n(e.ev_charging_kw),
    buildingKw: n(e.building_kw),
    solarKw: n(e.solar_kw),
    bessOutputKw: n(e.bess_output_kw),
    peak15Kw: n(e.peak_15min_kw),
    tariff: s(e.tariff),
    ratePerKwh: n(e.rate_per_kwh),
    bessSocPct: n(b.soc_pct),
    bessState: s(b.state),
    bessTempC: n(b.temp_c),
    bessPowerKw: n(b.power_kw),
    drActive: typeof g.dr_active === "boolean" ? g.dr_active : null,
    drCapKw: n(g.dr_cap_kw),
    lmpUsdMwh: n(g.lmp_usd_mwh),
    carbonGPerKwh: n(g.carbon_gco2_kwh),
    tempC: n(w.temp_c),
    conditions: s(w.conditions),
  };
}

/** Vehicles drawing power right now, grouped by charger type, from the joined fleet. */
export function chargingNow(rows: FleetRow[]): { dcfc: FleetRow[]; l2: FleetRow[] } {
  return {
    dcfc: rows.filter((r) => r.state === "charging_dcfc"),
    l2: rows.filter((r) => r.state === "charging_l2"),
  };
}

// ── decisions ────────────────────────────────────────────────────────────────
// A decision is worded in ONE place, ./decisionText.ts, which is the twin cockpit's own file carried verbatim, so
// the three cockpits say the same thing about the same decision. The engine's name ("deterministic_v1") and the
// action's name ("Task start") are not the verdict and are not shown as one.

/** Who a decision is about: the agent's pass and the site battery are not vehicles. */
export function decisionActor(d: ActivityRow): string {
  if (d.action === "orchestrator_agent") return "OTTO-Q agent";
  if (d.action === "bess_dispatch") return "Site battery";
  return d.display_name ?? "OTTO-Q";
}

/** A card's last decision in the feed's words. The card carries the verb beside the rationale rather than in it. */
export function cardDecisionText(dec: CardDecision): DecisionText {
  return describeDecision({
    occurred_at: dec.at ?? "",
    vehicle_id: null,
    display_name: null,
    action: dec.action,
    engine: dec.engine,
    target: null,
    outcome: dec.outcome,
    rationale: { ...(dec.rationale ?? {}), ...(dec.verb ? { verb: dec.verb } : {}) },
    reason: null,
    decision_seq: 0,
    tick_seq: null,
    held_ticks: null,
    last_at: null,
    standing: null,
  });
}
