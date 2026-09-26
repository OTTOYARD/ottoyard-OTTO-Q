// How full the twin depot's stalls are, by stall type, from the live snapshot's stall pointers and the depot layout.
// Pure, so it is tested on a real capture without a run.
//
// This is OCCUPANCY, a fact about the stall pointer: a car on the stall, or a live hold for one. It is not
// availability. Whether a stall can take a car also depends on its calendar and, for a charger, on the charger not
// being faulted, and OTTO-Q decides that. So nothing here is called "available".
//
// The snapshot publishes only stalls that carry a car or a live hold; a layout stall it does not list is open.
import type { TwinLayout, TwinSnapshot } from "./types";

export interface StallTypeCount {
  total: number;
  /** a car is on the stall */
  withCar: number;
  /** no car yet, but a live hold for one */
  held: number;
  /** neither */
  open: number;
}

export function stallOccupancy(
  layout: TwinLayout | null | undefined,
  snapshot: TwinSnapshot | null | undefined,
): Record<string, StallTypeCount> {
  const status = new Map((snapshot?.stalls_status ?? []).map((s) => [s.id, s] as const));
  const out: Record<string, StallTypeCount> = {};
  for (const stall of layout?.stalls ?? []) {
    const c = out[stall.type] ?? (out[stall.type] = { total: 0, withCar: 0, held: 0, open: 0 });
    c.total += 1;
    const s = status.get(stall.id);
    if (s?.vehicle_id) c.withCar += 1;
    else if (s?.reserved_by) c.held += 1;
    else c.open += 1;
  }
  return out;
}

/** The sum over several stall types, e.g. every charger (dcfc + l2). */
export function sumTypes(occ: Record<string, StallTypeCount>, types: string[]): StallTypeCount {
  const t: StallTypeCount = { total: 0, withCar: 0, held: 0, open: 0 };
  for (const k of types) {
    const c = occ[k];
    if (!c) continue;
    t.total += c.total;
    t.withCar += c.withCar;
    t.held += c.held;
    t.open += c.open;
  }
  return t;
}
