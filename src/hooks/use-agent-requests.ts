import { useQuery } from "@tanstack/react-query";
import {
  classifyRequestsError,
  fetchOperatorAgentRequests,
  TWIN_DEPOT_ID,
  type OperatorAgentRequestsReply,
  type RequestsProblem,
} from "@/lib/agent-requests";

/** A failed read, classified: 'not_enabled' / 'not_granted' are the expected states before the gateway is on. */
export class AgentRequestsError extends Error {
  readonly problem: RequestsProblem;
  constructor(problem: RequestsProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}

/**
 * The picked owner's agent requests at the twin depot (otto-q-core 0550; readable here once 0551 is applied).
 * Nothing is asked with no owner picked: the database answers one owner at a time, never everyone. Polls every 10 s
 * while it answers, and stops once the database says the gateway is not installed or not granted to this cockpit.
 */
export function useOperatorAgentRequests(fleetOperatorId: string | null, depotId: string = TWIN_DEPOT_ID) {
  return useQuery<OperatorAgentRequestsReply, AgentRequestsError>({
    queryKey: ["agent-requests", fleetOperatorId, depotId],
    enabled: !!fleetOperatorId,
    queryFn: async () => {
      try {
        return await fetchOperatorAgentRequests(fleetOperatorId as string, depotId);
      } catch (e) {
        throw new AgentRequestsError(classifyRequestsError(e), e instanceof Error ? e.message : String(e));
      }
    },
    retry: (count, err) => err.problem === "error" && count < 2,
    refetchInterval: (query) => (query.state.error && query.state.error.problem !== "error" ? false : 10_000),
  });
}
