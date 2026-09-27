# AGENTS.md — ottoyard-OTTO-Q (OrchestrAV)

> ## ⚠️ READ THE NAME TWICE
> **This repo is NOT the OTTO-Q brain.** It is **OrchestrAV**, the fleet-owner cockpit. The brain
> lives in `otto-q-core`. This naming trips every reviewer who meets the project. Nothing in this
> repo decides anything.

**What it is:** the cockpit a fleet operator logs into — Waymo Nashville, Tesla Robotaxi TN, Zoox
Southeast — to see **only their own vehicles**. Its sibling OTTO-PULSE (repo `ottoyard-field-ops`)
shows depot staff everything, all owners. Both read the same backend.

## The mandate this repo is currently under

Chase's instruction: *"The complete ecosystem tie-in between the Twin, OrchestrAV and OTTO-PULSE so
that they all depict the same information — and OTTO-Q being the orchestrator and sorter of all of
them."*

**One read contract, three projections.** `ottoq_depot_cards(depot_id, fleet_operator_id)` is already
that shape — **the operator filter is the only difference between this repo and OTTO-PULSE.** Extend
that pattern; do not build a parallel read surface.

## Landmines specific to this repo

- **Two databases are in play.** Data comes from `gxdrcyphqjzjsuhxuqtg` via
  `src/lib/otto-q-api.ts` (`ottoqRpc` for PostgREST RPCs, `ottoqInvoke` for edge functions). **Auth
  is still on the legacy `ycsisvozzgmisboumfqc` project.**
- ⚠️ **`useOTTOQRealtime` is dead code for anything on `gxdrc`** — it subscribes to `ycsis` tables.
  **Poll instead.** Removing or repointing it is on the backlog.
- **The Fleet tab already reads real `gxdrc` vehicle UUIDs** via `ottoqInvoke("ottoq-fleet-vehicles")`,
  and that edge function **already accepts a `fleet_operator_id` filter** — no ID mapping needed.
- **The per-vehicle card is `src/components/live/VehicleLiveCard.tsx`**, on the shared twin layer
  (`src/lib/twin/`, kept file-for-file identical with OTTO-PULSE). The older `OTTOQFleetView.tsx` and
  `VisitReportCard.tsx` were removed on 2026-09-26 with 57 other files nothing imported.
- ⚠️ **The user → fleet-operator binding is client-side only** (anon key, no JWT) and is
  **spoofable**. Fine for the demo; real tenancy is a known security gate. **Do not build anything
  that assumes it is trustworthy.**
- ⚠️ **`CLAUDE.md` in this repo is stale.** It describes an "OttoCommand AI" objective and says data
  access is "mock now" — neither reflects the current system, which reads live `gxdrc` data. Treat
  it as historical; **this file and the context repo are current.**
- **Card honesty rules — preserve them:** prune `skipped` legs · scope to the current visit ·
  **omit `deviation_s`** (corrupt baseline) · atoms use the JSON key `'svc'`.

## Branding — a standing founder want: "no lazy UI"

Dark, high-contrast, premium, red-accented. Backgrounds `#06070A` / `#0A0B0E` / `#111317` · ink
`#E7EAF0` / `#8A8F99` / `#4A4E57` · brand red `#C8102E` (hot `#E8293F`, deep `#8E0B20`).
Type: **Chakra Petch** display · **Inter Tight** body · **JetBrains Mono** for data and stall codes.

## Verify before you PR

```bash
npm run lint && npm run test:run && npm run build
```

⚠️ **This repo is Lovable-synced with two-way sync on `main`.** Chase's edits in Lovable commit
straight to `main` (as `gpt-engineer-app[bot]`), and merging your PR is picked up by Lovable
automatically. **Fetch before you push.**
---

## The full context lives elsewhere

**Read this first, before any substantive work:**

```bash
git clone https://github.com/OTTOYARD/ottoyard-agent-context.git
```

That repository is the shared brain for agents on this project: architecture, the founder's binding
doctrine, the known-issues register, a ranked backlog, hard-won lessons, and a verbatim copy of the
79 memory files Claude Code accumulated while building this system. Start with its `README.md` and
`docs/16_FIRST_SESSION_RUNBOOK.md`.

## Rules that apply in every OTTOYARD repo

**⚖️ The law.** *OTTO-Q decides. OTTO-TWIN executes and owns world state. The renderer only draws.*
Decision-layer code that mutates world state is a defect on sight. Renderer code containing world
logic is a defect on sight.

**Branch, verify, PR. Never merge.** Chase Ballenger (founder) is the only one who merges. Branch as
`hermes/<slug>` or `claude/<slug>`, prove it works yourself, then open a PR whose description carries
**the evidence** — real numbers, real row counts, real screenshots — plus what you did *not* verify
and what could break. Half-done labelled half-done is fine; half-done labelled done is not.

**🚨 `git fetch origin` before you reason about anything.** The clones on the founder's Desktop have
been up to **77 commits behind**. Compare against `origin/main`, never local `main`. A branch still
existing is not evidence it is unmerged — check
`git rev-list --count origin/main..origin/<branch>` (0 means merged).

**Two identity traps.** `OTTOYARD` on GitHub is a **personal account, not an organization**
(`/orgs/OTTOYARD/...` returns 404 — use `/user/repos`). And GitHub **rejects pushes authored as
`chase@ottoyard.com`** — commit as a noreply identity.

**Three Supabase projects — the engine is `gxdrcyphqjzjsuhxuqtg` (otto-q-core, us-east-1).**
`ycsisvozzgmisboumfqc` is the **OTTOYARD MVP** (us-east-2): the original demo backend, OrchestrAV's
auth/billing/retail (`ottoq_ps_*`) home, and the live intelligence pipeline (`intelligence_events`,
written every ≤3 min by its own pg_cron + `intelligence-*` edge functions) — active, never the
engine. `sovyxwtrqfmizelrammm` (Fleet Dashboard) is INACTIVE with zero live callers. ⚠️ **Every
`supabase/config.toml` in every OTTOYARD repo points somewhere else** — at dead refs
(`hfjaofyfxsyniohdfacg`, `odhpbdhnpcrjeaxvbrzd`), at the MVP, or at a placeholder. The real ref is
hardcoded in client code instead. **Pass `--project-ref gxdrcyphqjzjsuhxuqtg` explicitly to any
Supabase CLI command that writes.** (DB labels reconciled 2026-08-18 by Run 1 C1 — see
`SYSTEM_TOPOLOGY.md` in `otto-q-core`.)

**Never disable pg_cron job 12** (`ottoq-demo-metronome`). It **is** the simulation run engine.
Disabling it stops every run while everything still looks green.

**Honesty about numbers is a hard requirement here.** Always state your denominator. Never quote
`vehicles_turned_around`, `fleet_ready_pct`, or `gate_backlog` — they are final-frame instantaneous
counts that structurally penalise OTTO-Q. Interrogate the baseline before believing a win: it has
been invalid twice, both times in our favour. Read
`ottoyard-agent-context/memory/reference_ottoq_real_edge.md` before quoting any comparative figure.
