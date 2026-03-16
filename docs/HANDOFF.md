# Handoff

Last updated: 2026-03-16

## Read First

When starting the next round, read in this order:

1. `docs/PROJECT_STATUS.md`
2. `docs/CURRENT_SPRINT.md`
3. `docs/HANDOFF.md`
4. `docs/OPENCLAW_ADAPTATION.md`
5. `docs/DECISIONS.md`

## Current Repository State

- Branch: `feature/mvp-init`
- Product baseline: A1-A6 landed
- Current target: A7 Heartbeat Lite
- A6 status: completed
- Latest verification baseline:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`27 passed`)

## A6 Completion Snapshot

- Real membership state model is in place.
- Membership capability gating is real, not only copy-level.
- Student home, parent overview, membership page, continue-tracking page, and timeline already follow membership state.
- Admin manual membership management and logs are in place.
- Multi-student membership isolation is covered by e2e.

## Recommended Next Round

- A7: Heartbeat Lite

Suggested implementation direction:

- create a lightweight heartbeat rule layer on top of existing evidence, recheck, weekly report, and membership signals
- add a heartbeat hit-event layer so the system knows when a student has entered a heartbeat-worthy state
- support at least inactivity, overdue recheck, repeated unstable error, and undecided parent followup rules
- connect heartbeat pending items to the control center instead of building a new admin shell
- support admin manual run and lightweight in-app refresh only
- add dedicated A7 e2e

Expected A7 output:

- explicit heartbeat rules with inspectable config
- per-student / per-parent heartbeat events without cross-student leakage
- control center cards for today reminder / recheck / followup heartbeat items
- no standalone worker/cron and no payment work

## Constraints Still In Force

- Do not build official payment / subscription charging yet.
- Do not introduce worker / cron yet.
- Do not do large-scale base-layer refactor.
- Do not redo existing role shell or site shell.
- Keep one primary objective per round.

## Operating Rule

Before ending any future round:

- update `docs/HANDOFF.md`
- update `docs/PROJECT_STATUS.md` if stage truth changed
- run `typecheck`, `build`, and full `playwright`
- commit and push feature branch to both remotes

