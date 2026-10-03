// Agent requests, as the fleet owner sees them: what outside agents asked OTTO-Q about this owner's vehicles, and
// what became of each ask (otto-q-core 0559; readable from this cockpit once 0560 is applied).
//
// READ-ONLY by design. This cockpit reaches the engine with the public anon key and picks its owner on the device,
// so it cannot prove who is looking; deciding stays with the depot crew in OTTO-PULSE (a yard supervisor or ops
// manager), or with the owner once OrchestrAV signs its users in to the engine. The database says which, in
// `decide_note`. No mock data: before the gateway is on, this panel says so and shows nothing else.
import { Bot, Car, Clock, Home, MessageSquare, PlugZap, SlidersHorizontal, Zap } from "lucide-react";
import { useOperatorAgentRequests } from "@/hooks/use-agent-requests";
import {
  deciderText, engineOutcome, isAnswered, kindLabel, realTimeCT, splitRequests, statusMeta,
  type AgentRequest, type Tone,
} from "@/lib/agent-requests";
import { humanize, simTime } from "@/lib/twin/model";
import { Chip, Section } from "@/components/live/ui";

const TONE: Record<Tone, string> = {
  open: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  good: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  bad: "border-red-500/30 bg-red-500/15 text-red-300",
  warn: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  muted: "border-border bg-secondary text-muted-foreground",
};

function KindIcon({ kind }: { kind: string }) {
  const cls = "h-3.5 w-3.5 text-muted-foreground";
  if (kind === "note") return <MessageSquare className={cls} />;
  if (kind === "recall_vehicle") return <Home className={cls} />;
  if (kind === "ops_action") return <Zap className={cls} />;
  return <SlidersHorizontal className={cls} />;
}

function RequestRow({ r }: { r: AgentRequest }) {
  const meta = statusMeta(r);
  const outcome = engineOutcome(r);
  const decider = deciderText(r);
  return (
    <li className="space-y-1 px-3 py-2 text-[12px]" data-testid="agent-request">
      <div className="flex flex-wrap items-center gap-1.5">
        <KindIcon kind={r.kind} />
        <span className="font-medium">{r.title}</span>
        <Chip tone={TONE[meta.tone]}>{meta.label}</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{kindLabel(r.kind)} from {r.principal.name}</span>
        {r.vehicle ? (
          <span className="inline-flex items-center gap-1">
            <Car className="h-3 w-3" />
            <span className="font-mono text-foreground">{r.vehicle.label ?? r.vehicle.id.slice(0, 8)}</span>
            {r.vehicle.state ? ` · ${humanize(r.vehicle.state)}` : ""}
            {r.vehicle.soc != null ? ` · ${Math.round(r.vehicle.soc)}%` : ""}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />asked {realTimeCT(r.created_at)}{r.sim_clock ? ` (sim ${simTime(r.sim_clock)} CT)` : ""}</span>
      </div>
      {r.status === "pending" && !r.lapsed ? (
        <div className="text-[11px] text-muted-foreground">Waiting for the depot crew · lapses {realTimeCT(r.expires_at)}</div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          {decider ? `Decided by ${decider}${r.decided_at ? ` ${realTimeCT(r.decided_at)}` : ""}. ` : ""}
          {outcome ? <span className="text-foreground">{outcome} </span> : null}
          {meta.explain}
          {r.decision_note ? <span className="italic"> “{r.decision_note}”</span> : null}
        </div>
      )}
    </li>
  );
}

export function AgentRequestsPanel({ fleetOperatorId }: { fleetOperatorId: string | null }) {
  const q = useOperatorAgentRequests(fleetOperatorId);
  const title = (
    <span className="inline-flex items-center gap-2"><Bot className="h-4 w-4" />Agent requests</span>
  );

  if (!fleetOperatorId) {
    return (
      <Section title={title}>
        <p className="text-xs text-muted-foreground">
          Pick your fleet in "Viewing as" to see what outside agents have asked OTTO-Q about your vehicles. The engine
          answers one owner at a time, never all of them at once.
        </p>
      </Section>
    );
  }
  if (q.isLoading) return <Section title={title}><p className="text-xs text-muted-foreground">Reading agent requests…</p></Section>;

  if (q.error && q.error.problem !== "error") {
    return (
      <Section title={title}>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <PlugZap className="h-4 w-4" />Agent access is built but not enabled yet
          </p>
          <p>
            {q.error.problem === "not_enabled"
              ? "OTTO-Q's agent gateway (otto-q-core 0559) is not installed yet."
              : "OTTO-Q's agent gateway is installed, but this cockpit has not been given its read (otto-q-core 0560)."}{" "}
            Once it is, what your own agents and personal agents ask about your vehicles shows here, with the depot's
            decision and OTTO-Q's reply.
          </p>
        </div>
      </Section>
    );
  }
  if (q.error) {
    return <Section title={title}><p className="text-xs text-red-300">Could not read agent requests: {q.error.message}</p></Section>;
  }
  const data = q.data;
  if (!data) return null;
  if (!isAnswered(data)) {
    return <Section title={title}><p className="text-xs text-muted-foreground">{data.message ?? humanize(data.error)}</p></Section>;
  }

  const { open, closed } = splitRequests(data.items);
  return (
    <Section
      title={title}
      right={<span className="text-[11px] text-muted-foreground">{data.fleet_operator.name} · {data.counts.open} open · {data.counts.total} in total</span>}
    >
      <p className="mb-2 text-[11px] text-muted-foreground">
        Agents read OTTO-Q and ask; they change nothing themselves. {data.decide_note ?? "You can decide these once signed in to the engine."}
      </p>
      {data.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No agent has asked anything about {data.fleet_operator.name}'s vehicles yet.</p>
      ) : (
        <ol className="max-h-[420px] divide-y divide-border overflow-auto rounded-md border border-border">
          {[...open, ...closed].map((r) => <RequestRow key={r.request_id} r={r} />)}
        </ol>
      )}
    </Section>
  );
}
