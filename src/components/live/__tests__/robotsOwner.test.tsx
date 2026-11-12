// robotsOwner.test.tsx — what an owner reads about the depot's machines in OrchestrAV: on each of its cars' cards
// (the machines at work, the visit stage by stage, what each machine does), in the vehicle list, on the overview and
// on the stall board. Rendered with react-dom/server (this repo tests in node, with no DOM), on the hand-built scene
// in lib/twin/__tests__/fixtures/robotsScene.ts, which says how it was built.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { joinFleet } from "@/lib/twin/model";
import { machineFacts, vehicleMachines } from "@/lib/twin/robots";
import { CLOCK, RUN, cards, layout, snapshot, step } from "@/lib/twin/__tests__/fixtures/robotsScene";

const WAYMO = "op-w";
const feed = vi.hoisted(() => ({ mine: null as string | null }));

vi.mock("@/lib/twin/hooks", () => ({
  useLiveDepot: () => ({
    cards: { data: feed.mine ? { ...cards, vehicles: cards.vehicles.filter((v) => v.operator.id === feed.mine) } : cards, isLoading: false, error: null },
    snapshot: { data: snapshot }, condition: { data: null }, layout: { data: layout, isLoading: false },
    runId: RUN, runStatus: "running", simClock: CLOCK,
  }),
  useActivityFeed: () => ({ data: [], isLoading: false }),
}));
// the Overview's 3D frame is the twin's own page: not under test here
vi.mock("../TwinDepotView", () => ({ TwinDepotView: () => null }));

const { VehicleLiveCard } = await import("../VehicleLiveCard");
const { FleetPanel } = await import("../FleetPanel");
const { LiveOverview } = await import("../LiveOverview");
const { DepotPanel } = await import("../DepotPanel");

afterEach(() => { feed.mine = null; });

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const fleet = joinFleet(cards, snapshot, null);
const row = (id: string) => fleet.find((r) => r.id === id)!;
function card(id: string, opts: { expanded?: boolean; ownerNotes?: boolean } = {}) {
  const r = row(id);
  const html = renderToStaticMarkup(
    <VehicleLiveCard row={r} runId={RUN} expanded={!!opts.expanded} onToggle={() => {}} showOperator={false} machines={vehicleMachines(r, snapshot)} ownerNotes={opts.ownerNotes} />,
  );
  return { html, text: text(html) };
}
/** The text of each stage of the visit plan, in order. */
const stages = (html: string) => {
  const plan = html.slice(html.indexOf('data-testid="visit-plan"'));
  return plan.slice(0, plan.indexOf("</ol>")).split("<li ").slice(1).map(text);
};

describe("an owner's car at rest: the depot's machines at work on it", () => {
  it("a charging car: the charge arm connected, and the cabin clean under way with its end time", () => {
    const { html, text: t } = card("v1");
    expect(t).toMatch(/Charge arm connected/);
    expect(t).toMatch(/Cabin clean The arm cleans the cabin\. until 10:07 AM/);
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="52"/);
    expect(html).toContain(`title="${machineFacts("clean_arm").owner.join(" ").replace(/'/g, "&#x27;")}"`);
    expect(t).toMatch(/Interior tidy · cleaning arm/);
  });

  it("an arm reaching in says its retry, a finished clean says when, and a wash says when it ends", () => {
    expect(card("v2").text).toMatch(/Charge arm connects \(retry 1\)/);
    const done = card("v4");
    expect(done.text).toMatch(/Charge arm disconnects/);
    expect(done.text).toMatch(/Cabin clean Done\. 9:58 AM/);
    expect(card("v7").text).toMatch(/Robotic wash The machine washes the car\. Then 2 robot arms polish its sensors\. until 10:08 AM/);
    expect(card("v8").text).toMatch(/Robotic detail The machine washes the car\. Then 2 robot arms polish its sensors\. The doors stay shut\./);
    expect(card("v9").text).toMatch(/Robotic wash Done\. The car can leave\. 10:04 AM/);
  });

  it("a car no machine works on has no machine lines", () => {
    expect(card("v10").html).not.toContain('data-testid="machine-lines"');
    expect(card("v6").html).not.toContain('data-testid="machine-lines"');
  });
});

describe("an owner's car opened: the visit stage by stage, and what the machines do", () => {
  it("a charging car: each stage with its station, its times and the machine that does it", () => {
    const { html, text: t } = card("v1", { expanded: true, ownerNotes: true });
    expect(t).toMatch(/Visit plan/);
    const st = stages(html);
    expect(st).toHaveLength(5);
    expect(st[0]).toMatch(/DC fast charge · the charge arm connects the car fast charger 01 · since 10:01 AM · until ~10:40 AM/);
    expect(st[1]).toMatch(/Interior inspection · by the charger's sensors fast charger 01 · since 10:02 AM · until 10:06 AM/);
    expect(st[2]).toMatch(/Interior tidy · by the cleaning arm fast charger 01 · since 10:02 AM · until 10:07 AM/);
    expect(st[3]).toMatch(/Wash bay · by the wash machine wash bay 01 · planned 10:42 AM/);
    expect(st[4]).toMatch(/Readiness check planned 10:48 AM/);
  });

  it("says what each machine of this visit does, in an owner's words, once each", () => {
    const { html, text: t } = card("v1", { expanded: true, ownerNotes: true });
    expect(html).toContain('data-testid="machine-notes"');
    expect(t).toMatch(/The depot's machines on this visit/);
    expect(t).toMatch(/Charge arm A robot arm plugs your car in and unplugs it\. No person handles the cable\./);
    expect(t).toMatch(/Cleaning arm An overhead arm vacuums the cabin of your car while it charges\./);
    expect(t).toMatch(/Wash machine A machine washes your car in the wash bay\./);
    expect(html.match(/<dt/g)).toHaveLength(3);
    // a car only the wash machine works on names only that machine; a car no machine works on has no notes
    expect(card("v7", { expanded: true, ownerNotes: true }).html.match(/<dt/g)).toHaveLength(1);
    expect(card("v10", { expanded: true, ownerNotes: true }).html).not.toContain('data-testid="machine-notes"');
  });

  it("a finished visit: each stage once, with its real times, and no drives", () => {
    const st = stages(card("v5", { expanded: true, ownerNotes: true }).html);
    expect(st).toHaveLength(5);
    expect(st[0]).toMatch(/DC fast charge · the charge arm connects the car fast charger 05 · 9:09 AM to 9:31 AM/);
    expect(st[1]).toMatch(/Interior inspection · by the charger's sensors/);
    expect(st[2]).toMatch(/Interior tidy · by the cleaning arm fast charger 05 · 9:10 AM to 9:15 AM/);
    expect(st[3]).toMatch(/Wash bay · by the wash machine wash bay 02 · 9:36 AM to 9:41 AM/);
    expect(st[4]).toMatch(/Depart parking S001 · planned 10:30 AM/);
    expect(st.join(" ")).not.toMatch(/Taxi/);
  });

  it("a stage the engine records at one instant reads as done then, not as a span of no length", () => {
    const r = row("v5");
    const at = "2026-11-07T15:20:00+00:00";
    const steps = [...r.card!.steps, step(10, "sensor_clean", "done", { atom: "sensor_clean", to_stall_code: "NASH-DCFC-STALL-05", to_stall_kind: "charging", planned_start: at, planned_end: at, actual_start: at, actual_end: at })];
    const html = renderToStaticMarkup(<VehicleLiveCard row={{ ...r, card: { ...r.card!, steps } }} runId={RUN} expanded onToggle={() => {}} />);
    const clean = stages(html).find((x) => /Sensor clean/.test(x))!;
    expect(clean).toMatch(/Sensor clean fast charger 05 · done 9:20 AM/);
    expect(clean).not.toMatch(/ to /);
  });

  it("says so when OTTO-Q has published no plan", () => {
    const { html, text: t } = card("v6", { expanded: true, ownerNotes: true });
    expect(t).toMatch(/OTTO-Q has published no plan for this visit\./);
    expect(html).not.toContain('data-testid="visit-plan"');
  });
});

describe("the owner's vehicle list and overview", () => {
  const line = (html: string) => { const at = html.indexOf('data-testid="machines-at-work"'); return text(html.slice(at, at + 2600)); };

  it("the list counts the owner's own vehicles each machine is at work on", () => {
    feed.mine = WAYMO;
    const html = renderToStaticMarkup(<FleetPanel fleetOperatorId={WAYMO} showOperatorFilter={false} machineNotes />);
    expect(line(html)).toMatch(/Depot machines at work on these vehicles: Charge arm 1 Cleaning arm 1 Wash machine 1/);
    // only the owner's cars are listed
    expect(html).toContain('id="vehicle-v1"');
    expect(html).not.toContain('id="vehicle-v2"');
  });

  it("the overview counts them too, and names no Robots tab", () => {
    feed.mine = WAYMO;
    const html = renderToStaticMarkup(<LiveOverview fleetOperatorId={WAYMO} scopeLabel="your fleet" />);
    const t = text(html);
    expect(t).toMatch(/Depot machines at work \(your fleet\)/);
    expect(line(html)).toMatch(/Charge arm 1 vehicle A robot arm connects each car to its charger\. Cleaning arm 1 vehicle .* Wash machine 1 vehicle/);
    expect(t).not.toMatch(/Robots \(whole depot\)/);
  });

  it("with every owner in scope the same line counts every car", () => {
    const html = renderToStaticMarkup(<LiveOverview scopeLabel="all owners" />);
    expect(line(html)).toMatch(/Charge arm 3 vehicles .* Cleaning arm 1 vehicle .* Wash machine 2 vehicles/);
  });
});

describe("the stall board an owner sees", () => {
  it("counts a faulted charger as down, names only the owner's cars, and says what the charge arm is doing", () => {
    feed.mine = WAYMO;
    const t = text(renderToStaticMarkup(<DepotPanel fleetOperatorId={WAYMO} />));
    // three in use: two cars on a charger, and one whose arm is still pulling out
    expect(t).toMatch(/DC fast chargers 3\/6 in use 1 held · 1 free · 1 down/);
    expect(t).toMatch(/DCFC-STALL-04 in use arm: Pull the connector out/);
    expect(t).toMatch(/DCFC-STALL-01 Waymo-005 arm connected/);
    // another owner's car is in use, with no name
    expect(t).toMatch(/DCFC-STALL-02 in use arm: Align with the cameras/);
    expect(t).not.toMatch(/Zoox-011/);
    expect(t).toMatch(/DCFC-STALL-03 down fault: connector cable/);
  });
});
