// The depot's machines, read from the twin's feeds (../robots.ts), on a scene with every state the engine can
// publish (./fixtures/robotsScene.ts says how the scene was built).
import { describe, expect, it } from "vitest";
import type { FleetRow } from "../model";
import { joinFleet, needNote, stallBoard } from "../model";
import {
  MACHINE_KEYS, ROBOT_FACTS, byCleaningArm, byMachineWords, chargeArmRun, chargeStepWords, machineFacts, machineHeadline, machinesByCar,
  minutesLeft, performerWords, planStages, progressPct, robotBoard, serviceRun, stepBySensors, stepMachine, vehicleMachines, workState,
} from "../robots";
import type { TwinEventsWindow, TwinKpiBoard, TwinSnapshot } from "../types";
import { CLOCK, EVENTS, KPI, P01, STEPS_V1, STEPS_V5, atom, cards, layout, snapshot, step, visit } from "./fixtures/robotsScene";

const fleet: FleetRow[] = joinFleet(cards, snapshot, null);

describe("the facts file is the twin's", () => {
  it("names the three machines, each with its steps, facts and safety lines", () => {
    expect(ROBOT_FACTS.source.repo).toBe("OTTOYARD/ottoyarddepot-sim");
    expect(ROBOT_FACTS.machines.map((m) => m.key)).toEqual([...MACHINE_KEYS]);
    expect(machineFacts("charge_arm").name).toBe("OTTO-CHARGE ARM");
    expect(machineFacts("clean_arm").stallType).toBe("dcfc");
    expect(machineFacts("wash_gantry").stallType).toBe("wash_bay");
    for (const k of MACHINE_KEYS) {
      const m = machineFacts(k);
      expect(m.steps.length).toBeGreaterThanOrEqual(9);
      expect(m.facts.length).toBeGreaterThanOrEqual(6);
      expect(m.safety.length).toBeGreaterThanOrEqual(3);
      expect(m.owner.some((s) => /your car/i.test(s))).toBe(true);
    }
  });
  it("its charge arm times are the sum of its own steps", () => {
    const steps = machineFacts("charge_arm").steps;
    const i = steps.findIndex((s) => s.id === "charging");
    const sum = (xs: typeof steps) => xs.reduce((a, s) => a + (s.seconds ?? 0), 0);
    expect(sum(steps.slice(0, i))).toBeCloseTo(ROBOT_FACTS.chargeArm.connectSeconds, 9);
    expect(sum(steps.slice(i + 1))).toBeCloseTo(ROBOT_FACTS.chargeArm.releaseSeconds, 9);
    expect(chargeStepWords("align")).toBe("Align with the cameras");
    expect(chargeStepWords("warp")).toBeNull();
    expect(chargeStepWords(null)).toBeNull();
  });
});

describe("clocks", () => {
  it("progress is a share of the step at the run's clock, and null without both ends", () => {
    expect(progressPct("2026-11-07T16:00:00Z", "2026-11-07T16:10:00Z", "2026-11-07T16:05:00Z")).toBe(50);
    expect(progressPct("2026-11-07T16:00:00Z", "2026-11-07T16:10:00Z", "2026-11-07T15:00:00Z")).toBe(0);
    expect(progressPct("2026-11-07T16:00:00Z", "2026-11-07T16:10:00Z", "2026-11-07T17:00:00Z")).toBe(100);
    expect(progressPct(null, "2026-11-07T16:10:00Z", CLOCK)).toBeNull();
    expect(progressPct("2026-11-07T16:10:00Z", "2026-11-07T16:10:00Z", CLOCK)).toBeNull();
    expect(progressPct("2026-11-07T16:00:00Z", "soon", CLOCK)).toBeNull();
  });
  it("minutes left round up and never go below zero", () => {
    expect(minutesLeft("2026-11-07T16:07:48+00:00", CLOCK)).toBe(3);
    expect(minutesLeft("2026-11-07T16:05:01+00:00", CLOCK)).toBe(1);
    expect(minutesLeft("2026-11-07T16:04:00+00:00", CLOCK)).toBe(0);
    expect(minutesLeft(null, CLOCK)).toBeNull();
    expect(minutesLeft("2026-11-07T16:07:48+00:00", null)).toBeNull();
  });
});

describe("who does a need", () => {
  it("reads the cleaning arm from the card's performer or the snapshot's stall", () => {
    expect(byCleaningArm({ performed_by: "stall_cabin_robot" })).toBe(true);
    expect(byCleaningArm({ robot_stall_id: P01 })).toBe(true);
    expect(byCleaningArm({ performed_by: "charger_sensors" })).toBe(false);
    expect(byCleaningArm({ robot_stall_id: "" })).toBe(false);
    expect(byCleaningArm(null)).toBe(false);
    expect(performerWords({ performed_by: "stall_cabin_robot" })).toBe("by the stall's cleaning arm");
    expect(performerWords({ performed_by: "charger_sensors" })).toBe("by the charger's sensors");
    expect(performerWords({ performed_by: null })).toBeNull();
  });
  it("a need's chip names the cleaning arm, as it names the charger's sensors", () => {
    expect(needNote({ must_do: true, performed_by: "stall_cabin_robot" })).toEqual({
      note: "cleaning arm", title: "must do before dispatch; done by the stall's cleaning arm during the charge, no technician",
    });
    expect(needNote({ must_do: true, performed_by: "charger_sensors" }).note).toBe("charger sensors");
    expect(needNote({ must_do: false }).note).toBeNull();
  });
  it("an unknown status is still owed", () => {
    expect(workState("done")).toBe("done");
    expect(workState("IN_PROGRESS")).toBe("active");
    expect(workState("cancelled")).toBe("dropped");
    expect(workState("skipped")).toBe("dropped");
    expect(workState("pending")).toBe("open");
    expect(workState(undefined)).toBe("open");
    expect(workState("paused_for_review")).toBe("open");
  });
});

describe("robotBoard: every fast charger's two arms", () => {
  const b = robotBoard(layout, snapshot, fleet);
  const post = (n: string) => b.posts.find((p) => p.name === n)!;

  it("lists the fast chargers in number order, by the name the twin's plan draws", () => {
    expect(b.posts.map((p) => p.name)).toEqual(["DCFC-01", "DCFC-02", "DCFC-03", "DCFC-04", "DCFC-05", "DCFC-06"]);
    expect(b.simClock).toBe(CLOCK);
    expect(post("DCFC-01").canopy).toBe("CANOPY-01");
    expect(post("DCFC-01").connectorKw).toBe(350);
  });

  it("a charging car: the charge arm connected, the cleaning arm at work with its own times", () => {
    const p = post("DCFC-01");
    expect(p.state).toBe("in_use");
    expect(p.vehicleName).toBe("Waymo-005");
    expect(p.operatorName).toBe("Waymo Nashville");
    // the hold's lease (16:07) is not offered as the charge's end
    expect(p.charge).toEqual({ state: "connected", phase: "charging", step: "Charge", retry: 0, until: null });
    expect(p.clean.state).toBe("cleaning");
    expect(p.clean.startedAt).toBe("2026-11-07T16:02:00+00:00");
    expect(p.clean.endsAt).toBe("2026-11-07T16:07:48+00:00");
    expect(p.clean.progress).toBeCloseTo((180 / 348) * 100, 6);
    expect(p.clean.minutesLeft).toBe(3);
  });

  it("an arm reaching in reads its open cycle: the phase in words, and the retry the stall row does not carry", () => {
    const p = post("DCFC-02");
    expect(p.charge).toEqual({ state: "connecting", phase: "align", step: "Align with the cameras", retry: 1, until: "2026-11-07T16:05:04+00:00" });
    expect(p.clean.state).toBe("home");
    expect(p.vehicleName).toBe("Zoox-011");
  });

  it("a faulted charger is down, with its code and repair time, and both arms with it", () => {
    const p = post("DCFC-03");
    expect(p.state).toBe("down");
    expect(p.down).toEqual({ kind: "fault", code: "fault.connector_cable", until: "2026-11-07T19:27:51.149855+00:00" });
    expect(p.charge.state).toBe("down");
    expect(p.clean.state).toBe("down");
    expect(p.vehicleId).toBeNull();
  });

  it("an arm pulling out still names its car, which no longer points at the stall", () => {
    const p = post("DCFC-04");
    expect(p.state).toBe("in_use");
    expect(p.vehicleName).toBe("Tesla-AV-041");
    expect(p.charge).toEqual({ state: "releasing", phase: "extract", step: "Pull the connector out", retry: 0, until: "2026-11-07T16:05:02+00:00" });
    // its clean is done and the car is still there
    expect(p.clean).toEqual({ state: "done", startedAt: "2026-11-07T15:52:12+00:00", endsAt: "2026-11-07T15:58:00+00:00", doneAt: "2026-11-07T15:58:00+00:00", progress: null, minutesLeft: null });
  });

  it("a held charger names the car it is held for, and a clean done there earlier is not its news", () => {
    const p = post("DCFC-05");
    expect(p.state).toBe("held");
    expect(p.heldForName).toBe("Zoox-002");
    expect(p.heldUntil).toBe("2026-11-07T16:20:00+00:00");
    expect(p.charge.state).toBe("home");
    expect(p.clean.state).toBe("home"); // v5 was cleaned here at 9:10 and now stands in staging
  });

  it("a stall the snapshot does not list is free, with both arms home", () => {
    const p = post("DCFC-06");
    expect(p.state).toBe("free");
    expect(p.charge.state).toBe("home");
    expect(p.clean.state).toBe("home");
    expect(p.vehicleId).toBeNull();
  });

  it("on an older backend a hold with no direction is a release, and a row with no tether fields is not a hold", () => {
    const old = JSON.parse(JSON.stringify(snapshot)) as TwinSnapshot;
    old.arm = null;
    for (const s of old.stalls_status) { delete s.tether_direction; delete s.tether_phase; }
    const ob = robotBoard(layout, old, fleet);
    expect(ob.posts[0].charge.state).toBe("releasing");
    expect(ob.posts[0].charge.step).toBeNull();
    const none = JSON.parse(JSON.stringify(snapshot)) as TwinSnapshot;
    none.arm = null;
    for (const s of none.stalls_status) { delete s.tethered; delete s.tether_direction; delete s.tether_phase; }
    expect(robotBoard(layout, none, fleet).posts.every((p) => p.charge.state === "home" || p.charge.state === "down")).toBe(true);
  });

  it("counts each arm once", () => {
    expect(b.counts.chargeArms).toEqual({ total: 6, connecting: 1, connected: 1, releasing: 1, home: 2, down: 1 });
    expect(b.counts.cleanArms).toEqual({ total: 6, cleaning: 1, home: 4, down: 1 });
    const c = b.counts.chargeArms;
    expect(c.connecting + c.connected + c.releasing + c.home + c.down).toBe(c.total);
  });
});

describe("robotBoard: every wash bay's machine", () => {
  const b = robotBoard(layout, snapshot, fleet);
  it("a wash, a detail and a seat whose timer has run out", () => {
    expect(b.bays.map((x) => x.name)).toEqual(["wash bay 01", "wash bay 02", "wash bay 03"]);
    const [w1, w2, w3] = b.bays;
    expect(w1.state).toBe("washing");
    expect(w1.vehicleName).toBe("Waymo-031");
    expect(w1.progress).toBeCloseTo(40, 6);
    expect(w1.minutesLeft).toBe(3);
    expect(w1.finished).toBe(false);
    expect(w2.state).toBe("detailing");
    expect(w2.since).toBe("2026-11-07T15:55:00+00:00");
    expect(w2.endsAt).toBe("2026-11-07T16:11:30+00:00");
    expect(w2.minutesLeft).toBe(7);
    expect(w3.state).toBe("washing");
    expect(w3.finished).toBe(true);
    expect(w3.minutesLeft).toBe(0);
    // the third machine has finished: it is not counted as running
    expect(b.counts.washMachines).toEqual({ total: 3, running: 2, idle: 1, down: 0 });
  });
  it("a car in a bay with no seat published is in use, never guessed to be washing", () => {
    const old = JSON.parse(JSON.stringify(snapshot)) as TwinSnapshot;
    for (const v of old.fleet.vehicles) { delete v.bay_seat; if (v.id === "v7") v.state = "staged_awaiting_service"; }
    const ob = robotBoard(layout, old, fleet);
    expect(ob.bays[0].state).toBe("in_use");
    expect(ob.bays[0].progress).toBeNull();
    // seated by its state, with no times: washing, with no meter
    expect(ob.bays[1].state).toBe("detailing");
    expect(ob.bays[1].progress).toBeNull();
    expect(ob.bays[1].minutesLeft).toBeNull();
    expect(ob.bays[1].finished).toBe(false);
  });
});

describe("robotBoard: scope and empty feeds", () => {
  it("an owner's projection names only its own cars", () => {
    const mine = fleet.filter((r) => r.operatorName === "Waymo Nashville");
    const b = robotBoard(layout, snapshot, mine);
    expect(b.posts[0].vehicleName).toBe("Waymo-005");
    expect(b.posts[1].vehicleId).toBe("v2");
    expect(b.posts[1].vehicleName).toBeNull();
    expect(b.posts[1].operatorName).toBeNull();
    expect(b.posts[4].heldForName).toBeNull();
    expect(b.bays[1].vehicleName).toBeNull();
    // the machines' states are the depot's, whoever looks
    expect(b.counts).toEqual(robotBoard(layout, snapshot, fleet).counts);
  });
  it("no layout gives no machines, and no snapshot gives every machine home", () => {
    expect(robotBoard(null, snapshot, fleet).posts).toEqual([]);
    const b = robotBoard(layout, null, []);
    expect(b.simClock).toBeNull();
    expect(b.posts.every((p) => p.state === "free" && p.charge.state === "home" && p.clean.state === "home")).toBe(true);
    expect(b.bays.every((x) => x.state === "free")).toBe(true);
  });
});

describe("a machine kind in a line", () => {
  const b = robotBoard(layout, snapshot, fleet);
  it("says how many are on a car, and what the others do", () => {
    expect(machineHeadline("charge_arm", b, true)).toEqual({ value: "3/6", unit: "on a car", sub: "1 connected · 1 connecting · 1 releasing · 1 down" });
    expect(machineHeadline("clean_arm", b, true)).toEqual({ value: "1/6", unit: "cleaning", sub: "4 home · 1 down" });
    expect(machineHeadline("wash_gantry", b, true)).toEqual({ value: "2/3", unit: "running", sub: "1 idle" });
  });
  it("with no live run it counts the machines and measures nothing", () => {
    const idle = robotBoard(layout, null, []);
    expect(machineHeadline("charge_arm", idle, false)).toEqual({ value: "6", unit: "at the depot", sub: "no live run" });
    expect(machineHeadline("clean_arm", idle, false)).toEqual({ value: "6", unit: "at the depot", sub: "no live run" });
    expect(machineHeadline("wash_gantry", idle, false)).toEqual({ value: "3", unit: "at the depot", sub: "no live run" });
  });
});

describe("the stall board no longer calls a faulted charger free", () => {
  it("counts it as down", () => {
    const sb = stallBoard(layout, snapshot, fleet);
    const dcfc = sb.byType.find((t) => t.type === "dcfc")!;
    expect(dcfc).toEqual({ type: "dcfc", total: 6, occupied: 3, reserved: 1, available: 1, down: 1 });
    const p3 = sb.stalls.find((s) => s.code === "NASH-DCFC-STALL-03")!;
    expect(p3.status).toBe("down");
    expect(p3.down?.code).toBe("fault.connector_cable");
    expect(dcfc.occupied + dcfc.reserved + dcfc.available + dcfc.down).toBe(dcfc.total);
  });
  it("and does not call a charger free while its arm still holds a car", () => {
    // P04: the charge is over, the car no longer points at the stall and the stall reads 'available', but the arm
    // is still pulling out. The open cycle names the car.
    const p4 = stallBoard(layout, snapshot, fleet).stalls.find((s) => s.code === "NASH-DCFC-STALL-04")!;
    expect(p4.status).toBe("occupied");
    expect(p4.vehicleName).toBe("Tesla-AV-041");
    expect(p4.armPhase).toBe("extract");
    // with no open cycle published the stall is still in use, with no car named
    const noCycles = JSON.parse(JSON.stringify(snapshot)) as TwinSnapshot;
    noCycles.arm = null;
    const q4 = stallBoard(layout, noCycles, fleet).stalls.find((s) => s.code === "NASH-DCFC-STALL-04")!;
    expect(q4.status).toBe("occupied");
    expect(q4.vehicleName).toBeNull();
    // the robots' board agrees: in use, releasing, even when nothing says which car
    for (const v of noCycles.fleet.vehicles) if (v.id === "v4") v.stall_id = null;
    for (const v of noCycles.fleet.vehicles) if (v.id === "v4" && v.visit) v.visit.atoms = [];
    const b4 = robotBoard(layout, noCycles, fleet).posts.find((p) => p.name === "DCFC-04")!;
    expect(b4.state).toBe("in_use");
    expect(b4.vehicleId).toBeNull();
    expect(b4.charge.state).toBe("releasing");
  });
});

describe("the run so far", () => {
  it("the charge arms' results are the engine's own figures", () => {
    const r = chargeArmRun(snapshot, EVENTS);
    expect(r).toEqual({
      attempts: 229, cycles: 220, latched: 220, retried: 9, restageRequired: 0,
      firstPassPct: 95.91, portSeenPct: 95.63, errorMmP50: 3.7, errorMmP95: 8.73, errorMmMax: 82.67,
      tolerance: { lateralMm: 12, verticalMm: 12, yawDeg: 2.5 },
      connectsStarted: 220, connected: 220, released: 183, emergencyReleases: 11,
      connectSeconds: 18.5, releaseSeconds: 11.5,
    });
  });
  it("nothing measured is not a perfect score, and no events window is not zero events", () => {
    const idle = JSON.parse(JSON.stringify(snapshot)) as TwinSnapshot;
    idle.arm = { timings: null, accuracy: { attempts: 0 }, cycles: [] } as unknown as TwinSnapshot["arm"];
    const r = chargeArmRun(idle, null);
    expect(r.attempts).toBe(0);
    expect(r.firstPassPct).toBeNull();
    expect(r.errorMmP50).toBeNull();
    expect(r.connected).toBeNull();
    expect(r.emergencyReleases).toBeNull();
    expect(r.connectSeconds).toBeNull();
    // an events window that answered with no arm events is a real zero
    expect(chargeArmRun(idle, { by_type: {} } as unknown as TwinEventsWindow).emergencyReleases).toBe(0);
  });
  it("a service's count for the run is the KPI board's row, or null", () => {
    expect(serviceRun(KPI, "interior_tidy")).toEqual({ svc: "interior_tidy", name: "Interior tidy", done: 204, total: 215 });
    expect(serviceRun(KPI, "exterior_wash")).toEqual({ svc: "exterior_wash", name: "Exterior wash", done: 17, total: 17 });
    expect(serviceRun(KPI, "sensor_clean")).toBeNull();
    expect(serviceRun(null, "interior_tidy")).toBeNull();
    expect(serviceRun({ ok: false, error: "unknown_run" } as TwinKpiBoard, "interior_tidy")).toBeNull();
  });
});

describe("one car's machines", () => {
  const row = (id: string) => fleet.find((r) => r.id === id)!;
  it("a charging car: the charge arm connected and the cabin clean under way", () => {
    const m = vehicleMachines(row("v1"), snapshot);
    expect(m.map((x) => x.machine)).toEqual(["charge_arm", "clean_arm"]);
    expect(m[0]).toMatchObject({ title: "Charge arm", words: "connected", state: "working", endsAt: null });
    expect(m[1]).toMatchObject({ title: "Cabin clean", words: "The arm cleans the cabin.", state: "working", startedAt: "2026-11-07T16:02:00+00:00", endsAt: "2026-11-07T16:07:48+00:00" });
    expect(m[1].progress).toBeCloseTo((180 / 348) * 100, 6);
  });
  it("an arm reaching in says its retry, and an arm pulling out says so with the clean done", () => {
    expect(vehicleMachines(row("v2"), snapshot)).toEqual([
      { machine: "charge_arm", title: "Charge arm", words: "connects (retry 1)", state: "working", progress: null, startedAt: "2026-11-07T16:04:50+00:00", endsAt: "2026-11-07T16:05:04+00:00", doneAt: null },
    ]);
    const m = vehicleMachines(row("v4"), snapshot);
    expect(m[0]).toMatchObject({ machine: "charge_arm", words: "disconnects" });
    expect(m[1]).toEqual({ machine: "clean_arm", title: "Cabin clean", words: "Done.", state: "done", progress: null, startedAt: "2026-11-07T15:52:12+00:00", endsAt: "2026-11-07T15:58:00+00:00", doneAt: "2026-11-07T15:58:00+00:00" });
  });
  it("a car cleaned earlier keeps its clean on the card after it leaves the charger", () => {
    expect(vehicleMachines(row("v5"), snapshot)).toEqual([
      { machine: "clean_arm", title: "Cabin clean", words: "Done.", state: "done", progress: null, startedAt: "2026-11-07T15:10:00+00:00", endsAt: "2026-11-07T15:15:48+00:00", doneAt: "2026-11-07T15:15:48+00:00" },
    ]);
  });
  it("a wash, a detail, and a seat that has ended", () => {
    expect(vehicleMachines(row("v7"), snapshot)[0]).toMatchObject({ machine: "wash_gantry", title: "Robotic wash", words: "The machine washes the car.", state: "working", startedAt: "2026-11-07T16:03:00+00:00", endsAt: "2026-11-07T16:08:00+00:00" });
    expect(vehicleMachines(row("v8"), snapshot)[0]).toMatchObject({ title: "Robotic detail", words: "The machine cleans the cabin, then washes the car.", state: "working" });
    expect(vehicleMachines(row("v9"), snapshot)[0]).toMatchObject({ title: "Robotic wash", words: "Done. The car can leave.", state: "done", progress: 100, doneAt: "2026-11-07T16:04:00+00:00" });
    expect(vehicleMachines(row("v7"), snapshot)[0].doneAt).toBeNull();
  });
  it("a technician's tidy, a car on the road and a car with no snapshot are no machine's", () => {
    expect(vehicleMachines(row("v10"), snapshot)).toEqual([]);
    expect(vehicleMachines(row("v6"), snapshot)).toEqual([]);
    expect(vehicleMachines({ id: "v1", state: "charging_dcfc", visit: undefined, card: null }, null)).toEqual([]);
  });
  it("reads the clean from the card when the snapshot has not arrived", () => {
    const m = vehicleMachines({ ...row("v1"), visit: undefined }, null);
    expect(m).toEqual([
      { machine: "clean_arm", title: "Cabin clean", words: "The arm cleans the cabin.", state: "working", progress: null, startedAt: "2026-11-07T16:02:00+00:00", endsAt: "2026-11-07T16:07:48+00:00", doneAt: null },
    ]);
  });
  it("a cancelled clean (a charger fault cut it short) is not shown as work or as done", () => {
    const cut = { ...row("v1"), card: null, visit: visit([atom("interior_tidy", "cancelled", { performed_by: "stall_cabin_robot", robot_stall_id: P01 })]) };
    expect(vehicleMachines(cut, null)).toEqual([]);
  });
});

describe("machinesByCar: the cars each machine is at work on", () => {
  it("counts a car once for each machine at work on it, and not a machine that has finished", () => {
    const { lines, working } = machinesByCar(fleet, snapshot);
    expect(working).toEqual({ charge_arm: ["v1", "v2", "v4"], clean_arm: ["v1"], wash_gantry: ["v7", "v8"] });
    // v4's clean and v9's wash are done: they keep their line and are not counted as at work
    expect(lines.get("v4")!.map((l) => l.state)).toEqual(["working", "done"]);
    expect(lines.get("v9")!.map((l) => l.state)).toEqual(["done"]);
    expect(lines.has("v10")).toBe(false);
    expect(lines.has("v6")).toBe(false);
  });
  it("an owner's cars only, when the cockpit passes only those", () => {
    const mine = fleet.filter((r) => r.operatorName === "Waymo Nashville");
    expect(machinesByCar(mine, snapshot).working).toEqual({ charge_arm: ["v1"], clean_arm: ["v1"], wash_gantry: ["v7"] });
    expect(machinesByCar([], snapshot).working).toEqual({ charge_arm: [], clean_arm: [], wash_gantry: [] });
  });
});

describe("a plan's stages", () => {
  const armNeeds = [{ svc: "interior_tidy", status: "done", performed_by: "stall_cabin_robot" }];
  it("names the machine that does each step, and no machine for a technician's", () => {
    expect(stepMachine({ leg_type: "charge_dcfc" })).toBe("charge_arm");
    expect(stepMachine({ leg_type: "interior_tidy", atom: "interior_tidy" }, armNeeds)).toBe("clean_arm");
    expect(stepMachine({ leg_type: "interior_tidy", atom: "interior_tidy" }, [{ svc: "interior_tidy", status: "done" }])).toBeNull();
    expect(stepMachine({ leg_type: "interior_tidy", atom: "interior_tidy" })).toBeNull();
    expect(stepMachine({ leg_type: "wash", atom: "exterior_wash", to_stall_kind: "wash" })).toBe("wash_gantry");
    expect(stepMachine({ leg_type: "detail", atom: "interior_deep_clean" })).toBe("wash_gantry");
    for (const leg of ["charge_l2", "inspect", "service", "stage", "taxi", "depart", "sensor_clean", "item_retrieval"]) {
      expect(stepMachine({ leg_type: leg }, armNeeds)).toBeNull();
    }
  });
  it("a wash leg that does not go to a wash bay is no machine's", () => {
    expect(stepMachine({ leg_type: "wash", atom: "exterior_wash", to_stall_kind: "staging" })).toBeNull();
    expect(stepMachine({ leg_type: "detail", to_stall_kind: null })).toBe("wash_gantry");
  });
  it("tags a stage in plain words: the arm connects the car, and the charger charges it", () => {
    expect(byMachineWords("charge_arm")).toBe("the charge arm connects the car");
    expect(byMachineWords("clean_arm")).toBe("by the cleaning arm");
    expect(byMachineWords("wash_gantry")).toBe("by the wash machine");
  });
  it("knows a step the charger's own sensors do", () => {
    const needs = [{ svc: "interior_inspection", performed_by: "charger_sensors" }, { svc: "interior_tidy", performed_by: "stall_cabin_robot" }];
    expect(stepBySensors({ leg_type: "inspect", atom: "interior_inspection" }, needs)).toBe(true);
    expect(stepBySensors({ leg_type: "inspect", atom: "readiness_check" }, needs)).toBe(false);
    expect(stepBySensors({ leg_type: "interior_tidy", atom: "interior_tidy" }, needs)).toBe(false);
    expect(stepBySensors({ leg_type: "triage_check" }, [{ svc: "triage_check", performed_by: "charger_sensors" }])).toBe(true);
    expect(stepBySensors({ leg_type: "inspect", atom: "interior_inspection" })).toBe(false);
  });
});

describe("planStages: a car's visit, stage by stage", () => {
  const row = (id: string) => fleet.find((r) => r.id === id)!;
  const names = (xs: { leg_type: string; atom?: string | null; status: string }[]) => xs.map((x) => `${x.status}:${x.atom ?? x.leg_type}`);

  it("leaves out the drives, and a planned leg the engine closed with no duration when the arm took the work", () => {
    const st = planStages(STEPS_V5, row("v5").card!.needs);
    expect(names(st)).toEqual(["done:charge_dcfc", "done:interior_inspection", "done:interior_tidy", "done:exterior_wash", "upcoming:depart"]);
    // the tidy that stays is the arm's own, with its real times
    const tidy = st.find((x) => x.atom === "interior_tidy")!;
    expect(tidy.seq).toBe(5);
    expect(tidy.actual_end).toBe("2026-11-07T15:15:48+00:00");
    expect(st.some((x) => x.fromNeed)).toBe(false);
  });

  it("keeps a step with no duration when it is the only record of that work", () => {
    const lone = STEPS_V5.filter((x) => x.seq !== 5);
    expect(planStages(lone, []).filter((x) => x.atom === "interior_tidy").map((x) => x.seq)).toEqual([3]);
    // and keeps both records when they are at two stations (a charge cut by a fault, finished at another charger)
    const two = [step(2, "charge_dcfc", "done", { to_stall_code: "NASH-DCFC-STALL-01", actual_start: "2026-11-07T16:07:04+00:00", actual_end: "2026-11-07T16:07:04+00:00" }),
      step(5, "charge_dcfc", "done", { to_stall_code: "NASH-DCFC-STALL-17", actual_start: "2026-11-07T16:21:01+00:00", actual_end: "2026-11-07T16:51:55+00:00" })];
    expect(planStages(two, []).map((x) => x.seq)).toEqual([2, 5]);
  });

  it("adds the work under way that the card's one current step does not list, before what is still to come", () => {
    const r = row("v1");
    const st = planStages(STEPS_V1, r.visit!.atoms, { code: r.stallCode, kind: r.stallKind });
    expect(names(st)).toEqual(["current:charge_dcfc", "current:interior_inspection", "current:interior_tidy", "upcoming:exterior_wash", "upcoming:readiness_check"]);
    const [, insp, tidy] = st;
    expect(insp).toMatchObject({ leg_type: "inspect", fromNeed: true, to_stall_code: "NASH-DCFC-STALL-01", to_stall_kind: "charging", actual_start: "2026-11-07T16:02:00+00:00", expected_end: "2026-11-07T16:06:00+00:00" });
    expect(tidy).toMatchObject({ leg_type: "interior_tidy", fromNeed: true, actual_start: "2026-11-07T16:02:00+00:00", expected_end: "2026-11-07T16:07:48+00:00" });
    expect(stepMachine(tidy, r.visit!.atoms)).toBe("clean_arm");
    expect(stepBySensors(insp, r.visit!.atoms)).toBe(true);
    expect(new Set(st.map((x) => x.seq)).size).toBe(st.length);
  });

  it("does not add work that a step under way already lists, or the charge, or a need not started", () => {
    const steps = [step(3, "interior_tidy", "current", { atom: "interior_tidy", to_stall_code: "NASH-STG-S001", to_stall_kind: "staging" })];
    const needs = [atom("charge", "in_progress"), atom("interior_tidy", "in_progress"), atom("exterior_wash", "pending"), atom("sensor_clean", "done")];
    expect(planStages(steps, needs).map((x) => x.seq)).toEqual([3]);
    // a wash under way with no wash step: the stage is the wash bay's, named as a wash leg is
    const washing = planStages([], [atom("exterior_wash", "in_progress", { started_at: "2026-11-07T16:03:00+00:00", ends_at: "2026-11-07T16:08:00+00:00" })], { code: "NASH-WSH-01", kind: "wash" });
    expect(washing).toHaveLength(1);
    expect(washing[0]).toMatchObject({ leg_type: "wash", atom: "exterior_wash", status: "current", to_stall_kind: "wash" });
    expect(stepMachine(washing[0])).toBe("wash_gantry");
  });

  it("no steps and no needs is no plan", () => {
    expect(planStages(null, null)).toEqual([]);
    expect(planStages([], [])).toEqual([]);
    expect(planStages([step(1, "taxi", "done")], [])).toEqual([]);
  });
});
