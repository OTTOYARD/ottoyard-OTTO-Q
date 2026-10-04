// What an owner's agent set on its own cars, as the owner sees it in OrchestrAV (otto-q-core 0605/0606):
//   * AgentReceiptBanner  -- opened from an agent's receipt link: that command, in OTTO-Q's words, at the top;
//   * OwnerSettingChips   -- on a car's card: "Max 90% · your agent", a hold, a service order;
//   * OwnerSettingsPanel  -- on the Fleet tab: everything in force on the live run, and the agent's recent commands.
//
// READ-ONLY by design. The agent changes these through OTTO-Q's agent gateway with its own token, and OTTO-Q applies
// them at its next tick; this cockpit reaches the engine with the public anon key and changes nothing. No mock data:
// before 0605/0606 are applied, each piece says so and shows nothing else.
import type { ReactNode } from "react";
import { Bot, Clock, PlugZap, RotateCcw, X } from "lucide-react";
import type { Tone } from "@/lib/agent-requests";
import {
  agentLabel, commandState, groupInForce, isBoard, receiptText, settingChips, toolLabel,
  type OwnerCarSettings, type OwnerCommand,
} from "@/lib/owner-board";
import type { OwnerBoardQuery } from "@/hooks/use-owner-board";
import { humanize } from "@/lib/twin/model";
import { Chip, Section } from "@/components/live/ui";

const TONE: Record<Tone, string> = {
  open: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  good: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  bad: "border-red-500/30 bg-red-500/15 text-red-300",
  warn: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  muted: "border-border bg-secondary text-muted-foreground",
};
/** The agent's colour, the same on the card chips, the banner and the panel. */
export const AGENT_TONE = "border-violet-500/40 bg-violet-500/10 text-violet-200";

const NOT_ENABLED = "Owner settings are built but not switched on yet";

/** The confirmation code an applied command's receipt carried (0607/0608): the same code the agent relayed. */
function CodeChip({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <Chip tone={AGENT_TONE} title="Confirmation code: the same code your agent's receipt carried.">
      <span className="font-mono tracking-wide" data-testid="confirmation-code">{code}</span>
    </Chip>
  );
}

function notEnabledText(problem: string): string {
  return problem === "not_enabled"
    ? "OTTO-Q's owner settings (otto-q-core 0605/0606) are not installed yet."
    : "OTTO-Q's owner settings are installed, but this cockpit has not been given their read (otto-q-core 0606).";
}

/** On a car's card: what its owner's agent set. Nothing at all when the agent set nothing. */
export function OwnerSettingChips({ settings }: { settings?: OwnerCarSettings | null }) {
  const chips = settingChips(settings);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1" data-testid="owner-setting-chips">
      {chips.map((c) => (
        <Chip key={c.key} tone={AGENT_TONE} title={c.title}>
          <Bot className="h-3 w-3" />
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

function ReceiptBody({ c }: { c: OwnerCommand }) {
  const r = receiptText(c.summary);
  const state = commandState(c);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{r.head}</p>
      {r.bullets.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-[12px]">
          {r.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      ) : null}
      {r.notes.map((n) => <p key={n} className="text-[11px] text-muted-foreground">{n}</p>)}
      {state.label === "Run ended" ? (
        <p className="text-[11px] text-amber-200">
          This applied to a run that has ended. A stop or reset of the twin lifts everything an agent set, so these cars
          are back to baseline.
        </p>
      ) : null}
      {c.undone_at ? <p className="text-[11px] text-muted-foreground">Your agent has undone it since.</p> : null}
    </div>
  );
}

/**
 * Opened from an agent's receipt link (?source=agent&...&command=...): that command at the top of the cockpit, with
 * where it stands now -- in force, undone, refused, or lifted with its run.
 */
export function AgentReceiptBanner({ query, onDismiss }: { query: OwnerBoardQuery; onDismiss: () => void }) {
  const close = (
    <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
      <X className="h-4 w-4" />
    </button>
  );
  const frame = (children: ReactNode) => (
    <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-3" data-testid="agent-receipt">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {close}
      </div>
    </div>
  );

  if (query.isLoading) return frame(<p className="text-xs text-muted-foreground">Reading your agent's change…</p>);
  if (query.error) {
    if (query.error.problem !== "error") {
      return frame(
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{NOT_ENABLED}.</span> {notEnabledText(query.error.problem)} Your
          agent's change shows here once they are.
        </p>,
      );
    }
    return frame(<p className="text-xs text-red-300">Could not read your agent's change: {query.error.message}</p>);
  }
  const board = query.data;
  if (!isBoard(board)) return frame(<p className="text-xs text-muted-foreground">{board?.message ?? humanize(board?.error ?? "no answer")}</p>);
  const c = board.highlight;
  if (!c) {
    return frame(
      <p className="text-xs text-muted-foreground">
        This link names a change {board.fleet_operator.name}'s agent did not make here, or a preview, which changes
        nothing.
      </p>,
    );
  }
  const state = commandState(c);
  return frame(
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Chip tone={AGENT_TONE}><Bot className="h-3 w-3" />From your agent</Chip>
        <span className="font-medium text-foreground">{agentLabel(c)}</span>
        <span className="text-muted-foreground">· {toolLabel(c.tool)}</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />{c.created_at_local}{c.sim_clock_local ? ` (${c.sim_clock_local})` : ""}
        </span>
        <Chip tone={TONE[state.tone]} title={state.explain}>{state.label}</Chip>
        <CodeChip code={c.confirmation_code} />
      </div>
      <ReceiptBody c={c} />
    </div>,
  );
}

function CommandRow({ c }: { c: OwnerCommand }) {
  const r = receiptText(c.summary);
  const state = commandState(c);
  return (
    <li className="space-y-1 px-3 py-2 text-[12px]" data-testid="owner-command">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{toolLabel(c.tool)}</span>
        <Chip tone={TONE[state.tone]} title={state.explain}>{state.label}</Chip>
        <CodeChip code={c.confirmation_code} />
        {typeof c.cars === "number" && c.cars > 0 ? <span className="text-[11px] text-muted-foreground">{c.cars} car{c.cars === 1 ? "" : "s"}</span> : null}
      </div>
      <p>{c.outcome === "refused" ? (c.refusal?.message ?? r.head) : r.head}</p>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>from {agentLabel(c)}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.created_at_local}{c.sim_clock_local ? ` (${c.sim_clock_local})` : ""}</span>
      </div>
    </li>
  );
}

/** The Fleet tab's account of what the picked owner's agent has set, and what it has asked. */
export function OwnerSettingsPanel({ fleetOperatorId, query }: { fleetOperatorId: string | null; query: OwnerBoardQuery }) {
  const title = <span className="inline-flex items-center gap-2"><Bot className="h-4 w-4" />Set by your agent</span>;
  if (!fleetOperatorId) {
    return (
      <Section title={title}>
        <p className="text-xs text-muted-foreground">
          Pick your fleet in "Viewing as" to see what your own agent has set on your cars: charge limits, holds and
          service orders.
        </p>
      </Section>
    );
  }
  if (query.isLoading) return <Section title={title}><p className="text-xs text-muted-foreground">Reading what your agent set…</p></Section>;
  if (query.error) {
    if (query.error.problem !== "error") {
      return (
        <Section title={title}>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><PlugZap className="h-4 w-4" />{NOT_ENABLED}</p>
            <p>
              {notEnabledText(query.error.problem)} Once they are, what your personal agent sets on your cars -- how
              full they charge, services, holds -- shows here and on each car, with OTTO-Q's receipt.
            </p>
          </div>
        </Section>
      );
    }
    return <Section title={title}><p className="text-xs text-red-300">Could not read what your agent set: {query.error.message}</p></Section>;
  }
  const board = query.data;
  if (!board) return null;
  if (!isBoard(board)) return <Section title={title}><p className="text-xs text-muted-foreground">{board.message ?? humanize(board.error)}</p></Section>;

  const groups = groupInForce(board.in_force);
  const commands = board.commands ?? [];
  return (
    <Section
      title={title}
      right={
        <span className="text-[11px] text-muted-foreground">
          {board.fleet_operator.name} · {board.counts.charge_limits} limit{board.counts.charge_limits === 1 ? "" : "s"} ·{" "}
          {board.counts.holds} hold{board.counts.holds === 1 ? "" : "s"} · {board.counts.orders} order{board.counts.orders === 1 ? "" : "s"}
        </span>
      }
    >
      <p className="mb-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {board.resets} Your agent sets and undoes these through OTTO-Q; OTTO-Q decides when and where, and the cars'
          own driving system moves them. This cockpit only shows them.
        </span>
      </p>
      {!board.run ? (
        <p className="text-xs text-muted-foreground">No run is live, so nothing is in force: every car is at baseline.</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing is in force on this run: every car charges to {Math.round(board.full_pct)}% and gets what OTTO-Q finds
          it needs.
        </p>
      ) : (
        <ul className="mb-3 space-y-1" data-testid="owner-in-force">
          {groups.map((g) => (
            <li key={g.key} className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <Chip tone={AGENT_TONE}><Bot className="h-3 w-3" />{g.label}</Chip>
              <span className="text-muted-foreground">
                {g.vehicles.length} car{g.vehicles.length === 1 ? "" : "s"}
                {g.vehicles.length <= 4 ? `: ${g.vehicles.join(", ")}` : ""}
              </span>
              {g.waitingForTick ? <span className="text-[11px] text-amber-200" title="OTTO-Q applies a new setting at its next tick">applies at OTTO-Q's next tick</span> : null}
            </li>
          ))}
        </ul>
      )}
      {commands.length === 0 ? (
        <p className="text-xs text-muted-foreground">Your agent has not set anything on {board.fleet_operator.name}'s cars yet.</p>
      ) : (
        <ol className="max-h-[360px] divide-y divide-border overflow-auto rounded-md border border-border">
          {commands.map((c) => <CommandRow key={c.command_id} c={c} />)}
        </ol>
      )}
    </Section>
  );
}
