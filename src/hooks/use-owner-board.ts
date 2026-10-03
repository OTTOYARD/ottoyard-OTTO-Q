import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { agentLink, dismissAgentReceipt } from "@/lib/agentLink";
import { classifyBoardError, fetchOwnerBoard, type OwnerBoardReply } from "@/lib/owner-board";
import type { RequestsProblem } from "@/lib/agent-requests";
import { TWIN_DEPOT_ID } from "@/lib/agent-requests";

/** A failed read, classified: 'not_enabled' / 'not_granted' are the expected states before 0605/0606 are applied. */
export class OwnerBoardError extends Error {
  readonly problem: RequestsProblem;
  constructor(problem: RequestsProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}

export type OwnerBoardQuery = UseQueryResult<OwnerBoardReply, OwnerBoardError>;

/**
 * What the picked owner's agent has set, at the twin depot (otto-q-core 0606), and the command a receipt link names.
 * Nothing is asked with no owner picked. Polls every 10 s, so a setting the agent sends shows within one poll, and
 * stops once the database says the read is not installed or not granted to this cockpit.
 */
export function useOwnerBoard(fleetOperatorId: string | null, commandId: string | null = null, depotId: string = TWIN_DEPOT_ID): OwnerBoardQuery {
  return useQuery<OwnerBoardReply, OwnerBoardError>({
    queryKey: ["owner-board", fleetOperatorId, commandId, depotId],
    enabled: !!fleetOperatorId,
    queryFn: async () => {
      try {
        return await fetchOwnerBoard(fleetOperatorId as string, commandId, depotId);
      } catch (e) {
        throw new OwnerBoardError(classifyBoardError(e), e instanceof Error ? e.message : String(e));
      }
    },
    retry: (count, err) => err.problem === "error" && count < 2,
    refetchInterval: (query) => (query.state.error && query.state.error.problem !== "error" ? false : 10_000),
  });
}

/**
 * The receipt this tab was opened to show: the command an agent's link names, for as long as its owner is the one
 * picked and until it is dismissed.
 */
export function useAgentReceipt(fleetOperatorId: string | null): [string | null, () => void] {
  const [command, setCommand] = useState<string | null>(() => agentLink()?.command ?? null);
  const owner = agentLink()?.owner ?? null;
  const dismiss = () => {
    dismissAgentReceipt();
    setCommand(null);
  };
  return [command && owner && owner === fleetOperatorId ? command : null, dismiss];
}
