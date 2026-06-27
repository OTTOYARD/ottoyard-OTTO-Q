import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Send,
  CheckCircle2,
  ShieldQuestion,
  ShieldCheck,
  ShieldX,
  ArrowUp,
  ArrowDown,
  Gauge,
  Activity,
} from "lucide-react";
import {
  useFleetComms,
  type CommsMessage,
} from "@/hooks/use-fleet-comms";

// Pillar 2 — live fleet comms bus. Shows the real vehicle <-> OTTO-Q <-> teleoperator traffic,
// built to the protocols OEMs actually run (MQTT / SAE J2735 BSM / ISO 20078 / SAE J3016).

const AMBER = "hsl(45, 93%, 47%)";
const GREEN = "hsl(142, 76%, 36%)";
const VIOLET = "hsl(259, 70%, 62%)";

type Style = { label: string; color: string; icon: typeof Radio };

const styleFor = (m: CommsMessage): Style => {
  const cmd = (m.payload?.["command"] as string | undefined) ?? "";
  switch (m.msg_type) {
    case "telemetry":
      return { label: "BSM telemetry", color: "hsl(var(--primary))", icon: Radio };
    case "command":
      return { label: `${cmd || "command"}`, color: AMBER, icon: Send };
    case "ack":
      return { label: `${cmd || "ack"} · ack`, color: GREEN, icon: CheckCircle2 };
    case "assist_request":
      return { label: "teleop review", color: VIOLET, icon: ShieldQuestion };
    case "assist_response":
      return m.status === "deny"
        ? { label: "teleop · deny", color: "hsl(var(--destructive))", icon: ShieldX }
        : { label: "teleop · approve", color: GREEN, icon: ShieldCheck };
    default:
      return { label: m.msg_type, color: "hsl(var(--muted-foreground))", icon: Activity };
  }
};

const vehTag = (id: string | null) => (id ? id.slice(0, 8) : "—");
const clockOf = (t: string | null) =>
  t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export const FleetComms = () => {
  const { data, isLoading } = useFleetComms(80);
  const messages = data?.messages ?? [];
  const s = data?.summary;

  const stats = [
    { label: "BSM Telemetry", value: s?.telemetry ?? 0, sub: "uplink", icon: Radio, color: "hsl(var(--primary))" },
    { label: "Commands", value: s?.commands ?? 0, sub: "downlink", icon: Send, color: AMBER },
    { label: "Teleop Reviews", value: s?.teleopReviews ?? 0, sub: `${s?.teleopApproved ?? 0} approved · ${s?.teleopDenied ?? 0} denied`, icon: ShieldCheck, color: VIOLET },
    { label: "Avg Latency", value: s?.avgLatencyMs != null ? `${s.avgLatencyMs} ms` : "—", sub: "round-trip", icon: Gauge, color: GREEN },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Fleet Comms</h2>
          <p className="text-[11px] text-muted-foreground">
            MQTT transport · SAE&nbsp;J2735 BSM telemetry · ISO&nbsp;20078 envelope · SAE&nbsp;J3016 teleop
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">live · vehicle ↔ OTTO-Q ↔ teleop</Badge>
      </div>

      {/* Summary strip — derived from the live bus */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((st) => (
          <Card key={st.label} className="glass-card p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${st.color}20` }}>
                <st.icon className="h-4 w-4" style={{ color: st.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{st.label}</p>
                <p className="text-sm font-bold">{st.value}</p>
                <p className="text-[9px] text-muted-foreground truncate">{st.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* The bus — most recent traffic */}
      <Card className="glass-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Message Bus</p>
          <span className="text-[10px] text-muted-foreground">{messages.length} recent</span>
        </div>

        {messages.length === 0 ? (
          <div className="flex items-center justify-center text-center px-6 py-16">
            <p className="text-xs text-muted-foreground max-w-md">
              {isLoading
                ? "Connecting to the fleet comms bus…"
                : "No fleet comms in the recent window. The bus fills as OTTO-Q orchestrates a live operation — every deployed vehicle streams BSM telemetry, and OTTO-Q's dispatch/recall commands plus teleoperator confirmations flow through here in real time."}
            </p>
          </div>
        ) : (
          <div className="max-h-[460px] overflow-y-auto divide-y divide-border/60">
            {messages.map((m) => {
              const st = styleFor(m);
              const up = m.direction === "uplink";
              return (
                <div key={m.msg_id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20">
                  <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${st.color}20` }}>
                    <st.icon className="h-3.5 w-3.5" style={{ color: st.color }} />
                  </div>

                  <div className="flex items-center gap-1 shrink-0 w-[78px]" title={up ? "vehicle → OTTO-Q" : "OTTO-Q → vehicle"}>
                    {up ? <ArrowUp className="h-3 w-3 text-muted-foreground" /> : <ArrowDown className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-[10px] text-muted-foreground">{up ? "veh → Q" : "Q → veh"}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: st.color }}>{st.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{m.topic ?? "—"}</p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-muted-foreground">veh {vehTag(m.vehicle_id)}</span>
                    <div className="flex items-center gap-1">
                      {m.qos != null && <Badge variant="outline" className="text-[8px] px-1 py-0">QoS {m.qos}</Badge>}
                      {m.latency_ms != null && <span className="text-[9px] text-muted-foreground">{m.latency_ms}ms</span>}
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-[64px] text-right">{clockOf(m.sim_clock_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
