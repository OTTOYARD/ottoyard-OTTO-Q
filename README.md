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
| Overview | fleet by stage, the latest decisions | `ottoq_depot_cards`, `ottoq_activity_feed` |
| Fleet | each vehicle, its work card, OTTO-Q's decisions about it | `ottoq_depot_cards`, twin snapshot |
| Depots | stall occupancy and the reservation board | `ottoq_depot_cards`, depot layout |
| Energy | site power balance, battery, tariff, charging now | twin snapshot, `ottoq_twin_events_window` |
| Incidents | what went wrong this run, and standing depot conditions | `ottoq_run_event_feed` (the twin's Events wording) |
| Performance | the five KPIs, the learning loop's dial ledger, who is coming back, the site power plan | `/sim_runs/:id/kpis`, `ottoq_dial_promotion_ledger`, `ottoq_twin_appointments`, `service_profiles` |

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
