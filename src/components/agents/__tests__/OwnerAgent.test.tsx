// What an owner's agent set, as OrchestrAV shows it (otto-q-core 0605/0606), rendered (react-dom/server: this repo
// tests in node, with no DOM) through every state the engine can answer with, on REAL output of ottoq_owner_board
// (../../../lib/__tests__/fixtures/owner_board_capture.json). Read-only by design: the only button is the receipt's
// dismiss.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fx from "../../../lib/__tests__/fixtures/owner_board_capture.json";
import { AgentReceiptBanner, OwnerSettingChips, OwnerSettingsPanel } from "../OwnerAgent";
import type { OwnerBoardQuery } from "@/hooks/use-owner-board";

const TESLA = "33333333-3333-3333-3333-333333333333";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const q = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, error: null, ...over }) as unknown as OwnerBoardQuery;
const failed = (problem: string, message: string) => q({ error: Object.assign(new Error(message), { problem }) });
const banner = (query: OwnerBoardQuery) => {
  const html = renderToStaticMarkup(<AgentReceiptBanner query={query} onDismiss={() => {}} />);
  return { html, text: text(html) };
};
const panel = (id: string | null, query: OwnerBoardQuery) => {
  const html = renderToStaticMarkup(<OwnerSettingsPanel fleetOperatorId={id} query={query} />);
  return { html, text: text(html) };
};

describe("the receipt, opened from the agent's link", () => {
  it("shows the command in OTTO-Q's words, where it stands now, who sent it and when -- not the link back here", () => {
    const { html, text: t } = banner(q({ data: fx.tesla }));
    expect(t).toMatch(/From your agent chase-hermes · Charge limit/);
    expect(t).toMatch(/In force/);
    expect(t).toMatch(/Done\. All 4 Teslas charge to at most 90% instead of 100%\./);
    expect(t).toMatch(/1 is charging and will stop at 90%/);
    expect(t).toMatch(/This lasts until the demo run ends or you undo it\./);
    expect(t).not.toMatch(/See it in OrchestrAV/);
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toMatch(/aria-label="Dismiss"/);
  });

  it("says when the command's run has ended and the twin put every car back", () => {
    const t = banner(q({ data: fx.ended })).text;
    expect(t).toMatch(/Run ended/);
    expect(t).toMatch(/This applied to a run that has ended\. A stop or reset of the twin lifts everything an agent set/);
  });

  it("says so when the link names a command this owner's agent did not make", () => {
    expect(banner(q({ data: { ...fx.tesla, highlight: null } })).text)
      .toMatch(/This link names a change Tesla Robotaxi TN's agent did not make here, or a preview/);
  });

  it("is honest before 0605/0606 are applied, and about a real failure", () => {
    expect(banner(failed("not_enabled", "OTTO-Q rpc ottoq_owner_board 404: PGRST202")).text)
      .toMatch(/Owner settings are built but not switched on yet\. OTTO-Q's owner settings \(otto-q-core 0605\/0606\) are not installed yet\./);
    expect(banner(failed("not_granted", "OTTO-Q rpc ottoq_owner_board 401: 42501")).text)
      .toMatch(/has not been given their read \(otto-q-core 0606\)/);
    expect(banner(failed("error", "OTTO-Q rpc ottoq_owner_board 500: timeout")).text)
      .toMatch(/Could not read your agent's change: OTTO-Q rpc ottoq_owner_board 500: timeout/);
    expect(banner(q({ isLoading: true })).text).toMatch(/Reading your agent's change/);
  });
});

describe("the chips on a car's card", () => {
  it("show what the agent set on that car, and nothing for a car it set nothing on", () => {
    const html = renderToStaticMarkup(<OwnerSettingChips settings={fx.tesla.by_vehicle["ee000000-0000-0000-0000-0000000000b3"]} />);
    expect(text(html)).toMatch(/Max 90% · your agent.*Exterior wash · every return.*Mechanical PM · this visit/);
    expect(html).toMatch(/title="Your agent set this car to charge to at most 90% instead of 100%\./);
    expect(renderToStaticMarkup(<OwnerSettingChips settings={null} />)).toBe("");
  });
});

describe("the Fleet tab's panel", () => {
  it("asks nothing without an owner, and says why", () => {
    expect(panel(null, q({})).text).toMatch(/Pick your fleet in "Viewing as" to see what your own agent has set on your cars/);
  });

  it("lists what is in force, the reset rule, and every command with where it stands", () => {
    const { html, text: t } = panel(TESLA, q({ data: fx.tesla }));
    expect(t).toMatch(/Set by your agent/);
    expect(t).toMatch(/Tesla Robotaxi TN · 4 limits · 0 holds · 5 orders/);
    expect(t).toMatch(/a stop or reset of the twin puts every car back to baseline\./);
    expect(t).toMatch(/Charge to at most 90% 4 cars: Tesla-AV-001, Tesla-AV-041, Tesla-AV-045, Tesla-RT-003/);
    expect(t).toMatch(/applies at OTTO-Q's next tick/);
    expect(t).toMatch(/Service ordered In force 4 cars Done\. All 4 Teslas get exterior wash/);
    expect(t).toMatch(/Refused No car in your fleet matches "Tesla 98"\./);
    expect(html.match(/data-testid="owner-command"/g)?.length).toBe(fx.tesla.commands.length);
    expect(html).not.toMatch(/<button/);
  });

  it("after the run ends: nothing in force, and each command says its run ended", () => {
    const t = panel(TESLA, q({ data: fx.ended })).text;
    expect(t).toMatch(/No run is live, so nothing is in force: every car is at baseline\./);
    expect(t).toMatch(/Charge limit Run ended/);
  });

  it("passes on the database's own refusal, and is honest before the read is switched on", () => {
    expect(panel(TESLA, q({ data: fx.unknown_operator })).text).toMatch(/No such fleet operator\./);
    expect(panel(TESLA, failed("not_enabled", "404")).text).toMatch(/Owner settings are built but not switched on yet/);
    expect(panel(TESLA, failed("error", "OTTO-Q rpc ottoq_owner_board 500: timeout")).text).toMatch(/Could not read what your agent set/);
  });
});
