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
- Membership system: real state management is in place
- Latest verification baseline:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`27 passed`)

## Current Product Snapshot

- Parent/student/admin shell is in place.
- Multi-student isolation is in place.
- Recheck chain, evidence timeline, followup funnel, continue-tracking page, and control center are in place.
- Membership is no longer presentation-only; it now has real per-student state, benefits, admin manual management, and logs.

## Constraints Still In Force

- Do not build official payment / subscription charging yet.
- Do not introduce worker / cron yet.
- Do not rebuild admin base, role shell, recheck base, or permission base.
- Keep one primary objective per round.

## Recommended Next Round

- Candidate: A7 Heartbeat Lite

Suggested direction:

- build a lightweight recurring heartbeat layer
- keep it student-scoped
- make it consume existing evidence / recheck / membership signals
- do not expand into billing or infrastructure work

## Operating Rule

Before ending any future round:

- update `docs/HANDOFF.md`
- update `docs/PROJECT_STATUS.md` if stage truth changed
- run `typecheck`, `build`, and full `playwright`
- commit and push feature branch to both remotes
