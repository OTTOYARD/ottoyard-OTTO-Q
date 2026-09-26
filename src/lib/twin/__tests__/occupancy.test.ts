// Stall occupancy on a REAL capture (fixtures/live_capture.json: run 689095e2, busy_day, tick 50). The expected counts
// were read out of the capture by hand: the snapshot lists 136 of the layout's 158 stalls, 99 with a car and 37 held.
import { describe, expect, it } from "vitest";
import fx from "./fixtures/live_capture.json";
import type { TwinLayout, TwinSnapshot } from "../types";
import { stallOccupancy, sumTypes } from "../occupancy";

const layout = fx.layout as unknown as TwinLayout;
const snapshot = fx.snapshot as unknown as TwinSnapshot;

describe("stallOccupancy on the captured depot", () => {
  const occ = stallOccupancy(layout, snapshot);
  it("counts every layout stall once, by type", () => {
    expect(Object.fromEntries(Object.entries(occ).map(([k, c]) => [k, c.total]))).toEqual({
      staging: 113, l2: 30, dcfc: 10, wash_bay: 3, service_bay: 2,
    });
    for (const c of Object.values(occ)) expect(c.withCar + c.held + c.open).toBe(c.total);
  });
  it("splits each type into a car on it, a live hold, and open", () => {
    expect(occ.dcfc).toEqual({ total: 10, withCar: 10, held: 0, open: 0 });
    expect(occ.l2).toEqual({ total: 30, withCar: 28, held: 1, open: 1 });
    expect(occ.staging).toEqual({ total: 113, withCar: 59, held: 36, open: 18 });
    expect(occ.wash_bay).toEqual({ total: 3, withCar: 0, held: 0, open: 3 }); // not listed by the snapshot
    expect(occ.service_bay).toEqual({ total: 2, withCar: 2, held: 0, open: 0 });
  });
  it("sums the chargers", () => {
    expect(sumTypes(occ, ["dcfc", "l2"])).toEqual({ total: 40, withCar: 38, held: 1, open: 1 });
  });
  it("says nothing without a layout, and treats a missing snapshot as every stall open", () => {
    expect(stallOccupancy(null, snapshot)).toEqual({});
    expect(stallOccupancy(layout, null).dcfc).toEqual({ total: 10, withCar: 0, held: 0, open: 10 });
  });
});
