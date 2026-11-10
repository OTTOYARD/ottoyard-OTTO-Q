// The decision stream read (otto-q-core 0536): v2 carries the challenger's questions beside the decisions, and a
// database without 0536 still gets the decisions. Nothing else is swallowed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { twinApi } from "../client";

const reply = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("twinApi.activityFeed", () => {
  it("reads the stream with the challenger in it", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, '[{"action":"challenger_flag"}]'));
    vi.stubGlobal("fetch", fetch);
    await expect(twinApi.activityFeed("run-1")).resolves.toEqual([{ action: "challenger_flag" }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/rest\/v1\/rpc\/ottoq_activity_feed_v2$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_sim_run_id: "run-1", p_limit: 60, p_vehicle_id: null, p_changes_only: true });
  });

  it("falls back to the decisions alone when the database has no v2", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(404, '{"code":"PGRST202","message":"Could not find the function public.ottoq_activity_feed_v2"}'))
      .mockResolvedValueOnce(reply(200, "[]"));
    vi.stubGlobal("fetch", fetch);
    await expect(twinApi.activityFeed("run-1", { limit: 8 })).resolves.toEqual([]);
    expect(String(fetch.mock.calls[1][0])).toMatch(/\/rest\/v1\/rpc\/ottoq_activity_feed$/);
    expect(JSON.parse(fetch.mock.calls[1][1].body).p_limit).toBe(8);
  });

  it("does not hide any other failure behind the fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(500, '{"message":"canceling statement due to statement timeout"}'));
    vi.stubGlobal("fetch", fetch);
    await expect(twinApi.activityFeed("run-1")).rejects.toThrow(/ottoq_activity_feed_v2: 500/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("twinApi.kpiBoard", () => {
  it("asks the engine's own KPI board for the run, the read the twin's KPI tab uses", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, '{"ok":true,"service":{"by_service":[{"svc":"interior_tidy","name":"Interior tidy","lane":"cabin","done":204,"total":215}]}}'));
    vi.stubGlobal("fetch", fetch);
    const board = await twinApi.kpiBoard("run-1");
    expect(board.ok && board.service.by_service[0]).toEqual({ svc: "interior_tidy", name: "Interior tidy", lane: "cabin", done: 204, total: 215 });
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/rest\/v1\/rpc\/ottoq_twin_kpi_board$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_sim_run_id: "run-1" });
  });
});
