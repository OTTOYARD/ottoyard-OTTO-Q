import { useQuery } from "@tanstack/react-query";
import { ottoqTable } from "@/lib/otto-q-api";

// Live fleet comms bus on otto-q-core (Pillar 2). Reads ottoq_comms_messages directly via
// PostgREST — the vehicle <-> OTTO-Q <-> teleoperator traffic that the twin emits each tick.
// Built to real connected-vehicle protocols so an OEM sees their own parameters, not a toy:
//   transport = MQTT · telemetry = SAE J2735 BSM · envelope = ISO 20078 · teleop = SAE J3016.
// Empty/idle when no run is live — same honest pattern as the energy series.

export type CommsDirection = "uplink" | "downlink";
export type CommsMsgType =
  | "telemetry"
  | "command"
  | "ack"
  | "assist_request"
  | "assist_response";

export interface CommsMessage {
  msg_id: string;
  vehicle_id: string | null;
  correlation_id: string | null;
  direction: CommsDirection;
  topic: string | null;
  msg_type: CommsMsgType;
  qos: number | null;
  payload: Record<string, unknown> | null;
  status: string | null;
  latency_ms: number | null;
  sim_clock_at: string | null;
}

export interface CommsSummary {
  total: number;
  telemetry: number;
  commands: number;
  teleopReviews: number;
  teleopApproved: number;
  teleopDenied: number;
  avgLatencyMs: number | null;
  lastClock: string | null;
}

const SELECT =
  "select=msg_id,vehicle_id,correlation_id,direction,topic,msg_type,qos,payload,status,latency_ms,sim_clock_at";

export function useFleetComms(limit = 80) {
  return useQuery({
    queryKey: ["fleet-comms", limit],
    refetchInterval: 8000,
    queryFn: async () => {
      const rows = await ottoqTable<CommsMessage[]>(
        "ottoq_comms_messages",
        `${SELECT}&order=sim_clock_at.desc,msg_id.desc&limit=${limit}`
      );
      const list = rows ?? [];

      const lat = list
        .map((m) => m.latency_ms)
        .filter((v): v is number => v != null);
      const summary: CommsSummary = {
        total: list.length,
        telemetry: list.filter((m) => m.msg_type === "telemetry").length,
        commands: list.filter((m) => m.msg_type === "command").length,
        teleopReviews: list.filter((m) => m.msg_type === "assist_request").length,
        teleopApproved: list.filter(
          (m) => m.msg_type === "assist_response" && m.status === "approve"
        ).length,
        teleopDenied: list.filter(
          (m) => m.msg_type === "assist_response" && m.status === "deny"
        ).length,
        avgLatencyMs: lat.length
          ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)
          : null,
        lastClock: list[0]?.sim_clock_at ?? null,
      };

      return { messages: list, summary };
    },
  });
}
