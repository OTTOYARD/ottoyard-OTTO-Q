// What an owner's agent set (otto-q-core 0605), as this cockpit reads it through 0606's ottoq_owner_board -- on REAL
// output of that function (fixtures/owner_board_capture.json says where it was captured): a live run with a receipt's
// command in full, the two refusals, and the same owner after the run ended and lifted everything.
import { afterEach, describe, expect, it, vi } from "vitest";
import fx from "./fixtures/owner_board_capture.json";
import {
  classifyBoardError, commandState, commandVehicleIds, fetchOwnerBoard, groupInForce, isBoard, receiptText,
  settingChips, toolLabel, whenLabel, type OwnerBoard,
} from "../owner-board";
import { TWIN_DEPOT_ID } from "../agent-requests";

const TESLA = "33333333-3333-3333-3333-333333333333";
const live = fx.tesla as unknown as OwnerBoard;
const ended = fx.ended as unknown as OwnerBoard;
const reply = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("the read", () => {
  it("asks for one owner at the twin depot, with the command a receipt names, through the cockpit's anon client", async () => {
    const fetch = vi.fn().mockImplementation(async () => reply(200, JSON.stringify(fx.tesla)));
    vi.stubGlobal("fetch", fetch);
    const r = await fetchOwnerBoard(TESLA, "3594a58e-ea8f-4fa8-99ff-43c0b9e9742c");
    expect(isBoard(r)).toBe(true);
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/rest\/v1\/rpc\/ottoq_owner_board$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      p_fleet_operator_id: TESLA, p_depot_id: TWIN_DEPOT_ID, p_command_id: "3594a58e-ea8f-4fa8-99ff-43c0b9e9742c",
    });
    await fetchOwnerBoard(TESLA);
    expect(JSON.parse(fetch.mock.calls[1][1].body).p_command_id).toBeNull();
  });

  it("is refused by the database without an owner, or with one it does not know", () => {
    expect(isBoard(fx.no_operator as never)).toBe(false);
    expect(fx.no_operator).toEqual({ ok: false, error: "fleet_operator_required", message: "Name the fleet operator whose settings to read." });
    expect(fx.unknown_operator).toEqual({ ok: false, error: "unknown_fleet_operator", message: "No such fleet operator." });
  });

  it("tells 'not installed' and 'not granted to this cockpit' from a real failure", () => {
    expect(classifyBoardError(new Error('OTTO-Q rpc ottoq_owner_board 404: {"code":"PGRST202"}'))).toBe("not_enabled");
    expect(classifyBoardError(new Error('OTTO-Q rpc ottoq_owner_board 401: {"code":"42501"}'))).toBe("not_granted");
    expect(classifyBoardError(new Error("OTTO-Q rpc ottoq_owner_board 500: timeout"))).toBe("error");
  });
});

describe("a car's settings, as chips on its card", () => {
  it("says what the agent set, in the owner's words, with why in the tooltip", () => {
    const av045 = live.by_vehicle["ee000000-0000-0000-0000-0000000000b3"];
    const chips = settingChips(av045);
    expect(chips.map((c) => c.label)).toEqual(["Max 90% · your agent", "Exterior wash · every return", "Mechanical PM · this visit"]);
    expect(chips[0].title).toBe("Your agent set this car to charge to at most 90% instead of 100%. It lifts when the demo run ends.");
    expect(chips[1].title).toMatch(/does not leave with it undone/);
  });

  it("shows a hold by its sim time, and nothing at all for a car with no settings", () => {
    expect(settingChips({ hold_until_local: "6:00 AM sim time", hold_until_sim: "2026-09-27T11:00:00+00:00" })).toEqual([{
      key: "hold", label: "Held until 6:00 AM",
      title: "Your agent asked OTTO-Q not to let this car leave before 6:00 AM sim time. A hold only delays a departure; it never moves the car.",
    }]);
    expect(settingChips(undefined)).toEqual([]);
    expect(settingChips({})).toEqual([]);
  });
});

describe("the receipt", () => {
  it("splits OTTO-Q's receipt into its sentence, its per-car lines and its notes, without the link back here", () => {
    const r = receiptText(live.highlight?.summary);
    expect(r.head).toBe("Done. All 4 Teslas charge to at most 90% instead of 100%.");
    expect(r.bullets).toEqual([
      "1 is charging and will stop at 90%",
      "1 already has enough charge for 90%",
      "1 is out; it charges to 90% when it next comes in",
      "1 is charging past 90%: its charge ends at the next tick",
    ]);
    expect(r.notes).toEqual(["This lasts until the demo run ends or you undo it."]);
    expect(receiptText(null)).toEqual({ head: "", bullets: [], notes: [] });
  });

  it("names the cars it touched, for marking their cards", () => {
    expect([...commandVehicleIds(live.highlight)].sort()).toEqual([
      "ee000000-0000-0000-0000-0000000000b1", "ee000000-0000-0000-0000-0000000000b2",
      "ee000000-0000-0000-0000-0000000000b3", "ee000000-0000-0000-0000-0000000000b4",
    ]);
    expect(commandVehicleIds(null).size).toBe(0);
  });

  it("says where a command stands now, which can differ from what it was when sent", () => {
    expect(commandState(live.highlight as never).label).toBe("In force");
    expect(commandState(ended.highlight as never)).toEqual({
      label: "Run ended", tone: "muted", explain: "Its run has ended, and a stop or reset of the twin lifts everything an agent set.",
    });
    const refused = live.commands.find((c) => c.outcome === "refused");
    expect(refused?.refusal?.message).toMatch(/^No car in your fleet matches "Tesla 98"\./);
    expect(commandState(refused as never).label).toBe("Refused");
    expect(commandState({ outcome: "applied", live_run: true, undone_at: "2026-10-03T03:00:00Z" }).label).toBe("Undone");
    expect(commandState({ outcome: "no_change", live_run: true }).label).toBe("Nothing to change");
  });

  it("labels every owner command and when", () => {
    expect(["set_charge_limit", "clear_charge_limit", "request_service", "cancel_service", "hold_vehicle", "release_hold", "undo_command"].map(toolLabel))
      .toEqual(["Charge limit", "Charge limit cleared", "Service ordered", "Order withdrawn", "Hold", "Hold released", "Undo"]);
    expect(["now", "next_return", "every_return"].map(whenLabel)).toEqual(["this visit", "next return", "every return"]);
  });
});

describe("what is in force", () => {
  it("one line per setting, with the cars that carry it", () => {
    const groups = groupInForce(live.in_force);
    expect(groups.map((g) => [g.label, g.vehicles.length])).toEqual([
      ["Charge to at most 90%", 4],
      ["Exterior wash · every return", 4],
      ["Mechanical PM · this visit", 1],
    ]);
    expect(groups[0].waitingForTick).toBe(true);
  });

  it("after the run ends nothing is in force, and the board says the run is gone", () => {
    expect(ended.run).toBeNull();
    expect(ended.in_force).toEqual([]);
    expect(ended.counts).toEqual({ holds: 0, orders: 0, charge_limits: 0 });
    expect(ended.commands.every((c) => !c.live_run)).toBe(true);
    expect(ended.highlight?.lifted_at).toBeTruthy();
  });
});
