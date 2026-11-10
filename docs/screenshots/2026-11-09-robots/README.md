# The depot's machines, for an owner, in OrchestrAV (2026-11-09)

What an owner reads about the depot's charge arms, cleaning arms and wash machines: through its own cars.
Every shot is OrchestrAV viewing as Waymo Nashville (46 vehicles).

**These are a STAGED scene. No run was live when they were made, and none was started for them** (a new run purges
the last run's working data).

How they were made: Playwright (Chromium) against the Vite dev server, with every backend request answered locally.

- **Real, read from the engine on 2026-11-09:** the depot layout (30 fast chargers, 3 wash bays) and the 116 cars
  with their names and owners (`ottoq_depot_cards`).
- **Staged by hand, in the shapes the engine publishes:** the clock (10:05 AM), which car stands where, each
  machine's state, and each car's needs and plan steps. Of Waymo's 46 cars, 8 are on a charge arm, 1 has its cabin
  cleaned by the arm, and 1 is in a wash bay.

The shapes were read from the engine's own functions and rows (`ottoq_twin_snapshot`, `ottoq_depot_cards` 1.5, run
a0001fd6's itinerary legs), and the unit tests hold the same shapes
(`src/lib/twin/__tests__/fixtures/robotsScene.ts`). **Not yet seen: these screens on a live run.**

| File | What it shows |
|---|---|
| `1-overview-machines-at-work.jpg` | The Overview's count of the owner's vehicles each depot machine is at work on |
| `2-fleet-machines-at-work.jpg` | The Fleet tab at 1440 px: the same count as a filter line, and each car's machine lines (charge arm connected, cabin clean under way or done with its time) |
| `3-car-opened-visit-plan.jpg` | One car opened while the cleaning arm works on it: the visit stage by stage with the station and who does each stage, and what each machine of this visit does to the car |
| `4-car-finished-visit.jpg` | A car with its visit behind it: each stage once, with its station and its real times, and no drives |
| `5-depots-fast-chargers.jpg` | The Depots tab's fast chargers as this owner sees them: its own cars by name, every other car "in use", a faulted charger in red, and what the charge arm is doing at each stall |
| `6-car-opened-phone.jpg` | The opened car at 390 px |

A line's hover text (what the machine does, in an owner's words) does not show in a still. The tests check it.
