// What the Incidents view shows, from the run's own event feed (ottoq_run_event_feed): every event the emitter
// marked a warning or worse, in the twin cockpit's words (./eventFeed, carried verbatim). Pure, so it is tested
// on real rows without a run.
//
//   attention  one thing happened to one vehicle, charger or the engine: a charger fault, an arm emergency
//              release, a delayed arrival, a refused command, a bay visit cut short, a failed tick.
//   standing   a depot-wide condition the engine re-reports every tick (staging over capacity, the readiness
//              gate holding cars). The feed already collapses it to one row with a count and a start time.
import { eventDomain, eventTone, type RunEventRow } from "./eventFeed";

const VEHICLE_ENTITIES = new Set(["vehicle", "ocpp_session"]);

export interface IncidentGroups {
  attention: RunEventRow[];
  standing: RunEventRow[];
}

/**
 * Split the feed into incidents and standing conditions. With `ownVehicleNames`, an owner's projection keeps only
 * the incidents that name one of its vehicles (a charger session is named for its vehicle); depot-wide standing
 * conditions stay, because they are the same depot the owner's cars are in.
 */
export function incidentGroups(rows: RunEventRow[] | null | undefined, ownVehicleNames?: Set<string> | null): IncidentGroups {
  const attention: RunEventRow[] = [];
  const standing: RunEventRow[] = [];
  for (const r of rows ?? []) {
    if (eventTone(r.severity) === "normal" || eventDomain(r.event_type) === "records") continue;
    const onVehicle = VEHICLE_ENTITIES.has(r.entity_type ?? "");
    if (r.standing && !onVehicle) {
      standing.push(r);
      continue;
    }
    if (ownVehicleNames && !(onVehicle && r.entity_name && ownVehicleNames.has(r.entity_name))) continue;
    attention.push(r);
  }
  const bySimDesc = (a: RunEventRow, b: RunEventRow) => Date.parse(b.sim_at) - Date.parse(a.sim_at);
  return { attention: attention.sort(bySimDesc), standing: standing.sort(bySimDesc) };
}
