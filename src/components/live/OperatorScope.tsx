// OrchestrAV is the fleet OWNER's cockpit: it shows one owner's vehicles. Until sign-in carries
// an operator binding, the owner is picked here and remembered on this device. The list of
// owners comes from the live card feed, never a hardcoded roster.
import { useEffect, useState } from "react";
import { useDepotCards } from "@/lib/twin/hooks";
import { operatorsOf } from "@/lib/twin/model";
import { DecisionFeed } from "./DecisionFeed";

const KEY = "orchestrav.fleetOperatorId";

export function useOperatorScope(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY) || null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode: scope just is not remembered */
    }
  }, [id]);
  return [id, setId];
}

export function OperatorScopePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { data } = useDepotCards(null);
  const ops = operatorsOf(data);
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Viewing as</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 rounded-md border border-border bg-card px-2 text-xs"
      >
        <option value="">All owners (depot view)</option>
        {/* The count is the owner's whole fleet at this depot, on site or deployed. */}
        {ops.map((o) => (
          <option key={o.id} value={o.id}>{o.name} ({o.count} vehicles)</option>
        ))}
      </select>
    </label>
  );
}

/** OTTO-Q's decisions for the owner's vehicles only (all decisions when no owner is picked). */
export function ScopedDecisionFeed({ fleetOperatorId }: { fleetOperatorId: string | null }) {
  const { data } = useDepotCards(fleetOperatorId);
  const ids = fleetOperatorId ? new Set((data?.vehicles ?? []).map((v) => v.vehicle_id)) : null;
  return <DecisionFeed vehicleIds={ids} limit={120} scopeLabel={fleetOperatorId ? "your vehicles" : "all owners"} />;
}
