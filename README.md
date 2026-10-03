# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/10c7ad26-937b-4b92-85cd-b8ea79d185b9

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/10c7ad26-937b-4b92-85cd-b8ea79d185b9) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## The dashboard's tabs (live from OTTO-TWIN)

Every tab reads the run that is live on the twin depot (OTTOYARD Nashville Flagship) through the shared twin
layer in `src/lib/twin` and the panels in `src/components/live`, the same files OTTO-PULSE carries. With no live
run, each tab says so; nothing falls back to seeded or remembered data. "Viewing as" scopes every panel to one
owner's vehicles.

| Tab | What it shows | Source |
|---|---|---|
| Overview | the live depot in 3D (OTTO-TWIN's own scene, framed), fleet by stage, the latest decisions | OTTO-TWIN `/view.html`, `ottoq_depot_cards`, `ottoq_activity_feed` |
| Fleet | each vehicle, its work card, OTTO-Q's decisions about it; with an owner picked, what the owner's own agent set on its cars (charge limit, holds, service orders: on each card and in "Set by your agent"), and what outside agents asked about that owner's vehicles and what became of each ask (all read-only; the depot crew decides requests in OTTO-PULSE) | `ottoq_depot_cards`, twin snapshot, `ottoq_owner_board` (otto-q-core 0605/0606), `ottoq_agent_requests_for_operator` (otto-q-core 0559, readable here once 0560 is applied; until then each panel says it is built but not switched on) |
| Depots | stall occupancy and the reservation board | `ottoq_depot_cards`, depot layout |
| Energy | site power balance, battery, tariff, charging now | twin snapshot, `ottoq_twin_events_window` |
| Incidents | what went wrong this run, and standing depot conditions, including a car kept from leaving unfinished and a car held past the readiness gate's limit for a person (vehicle first: no car leaves with a service still needed) | `ottoq_run_event_feed` (the twin's Events wording) |
| Performance | the five KPIs, the learning loop's dial ledger, who is coming back, the site power plan | `/sim_runs/:id/kpis`, `ottoq_dial_promotion_ledger`, `ottoq_twin_appointments`, `service_profiles` |

## The live 3D depot on the Overview tab

The Overview tab opens on the twin depot in 3D: OTTO-TWIN's own scene, motion and snapshots, framed from
`<twin>/view.html` (`src/components/live/TwinDepotView.tsx`, contract in `src/lib/twin/twinView.ts`, the twin's side
in ottoyarddepot-sim `docs/LIVE-VIEW.md`). Before a run starts it shows the empty depot; once one is live the cars
move as they do in the twin. Opened from the twin (`?source=twin&run=`), it shows that run, like every other panel.
It can be turned from any corner or a pole at the middle of the lot, followed car by car, and made full screen.
It stops drawing while it is scrolled out of view. `VITE_TWIN_URL` points it at another twin (a preview, or
`http://localhost:8080` in development).

## Opened from an owner's agent's receipt

An owner's personal agent (Chase's Hermes, first) can set what its own cars need through OTTO-Q's agent gateway: how
full they charge, services, holds (otto-q-core 0605, `PERSONAL_AGENT.md` there). Every receipt it gets back ends with a
link here:

    ?source=agent&run=<sim_run_id>&owner=<fleet_operator_id>&tab=fleet&command=<command_id>

Opened, OrchestrAV opens as that owner on the Fleet tab, with the command's receipt on top in OTTO-Q's own words and
where it stands now (in force, undone, refused, or lifted when its run ended); the cars it touched are ringed and
listed first when it touched some of them (`src/lib/agentLink.ts`, `src/components/agents/OwnerAgent.tsx`). It does
not pin the run as a twin link does: a stop or reset of the twin lifts everything an agent set, and the receipt says
so. Read-only: the agent changes these, never this cockpit. Screenshots: `docs/screenshots/2026-10-03-owner-agent/`.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/10c7ad26-937b-4b92-85cd-b8ea79d185b9) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
