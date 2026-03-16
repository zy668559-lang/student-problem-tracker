# Handoff

Last updated: 2026-03-17

## Read First

When starting the next round, read in this order:

1. `docs/PROJECT_STATUS.md`
2. `docs/CURRENT_SPRINT.md`
3. `docs/HANDOFF.md`
4. `docs/OPENCLAW_ADAPTATION.md`
5. `docs/DECISIONS.md`
6. `docs/U1_VISUAL_INFO_REDUCTION.md`

## Current Repository State

- Branch: `feature/mvp-init`
- Product baseline: A1-A7 landed
- Current round: U1 visual and information reduction
- U1 status: completed
- Latest verification status:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`30 passed`)
- Latest push status:
  - `github/feature/mvp-init`: pushed
  - `gitee/feature/mvp-init`: pushed

## U1 Completion Snapshot

- Parent overview first screen now keeps exactly four first-level blocks:
  - current biggest blocker
  - what to do this week
  - the still-unstable step
  - why continued tracking still matters
- Student home first screen now keeps exactly four first-level blocks:
  - do this first today
  - latest result
  - this week's focus
  - next recheck target
- Membership page is now a tier-difference page instead of a long explanation page.
- Left navigation is regrouped into parent view, student view, and system / operations.
- Parent overview main chart uses four-state horizontal rails.
- Parent overview secondary chart uses 4-week change bars.
- Membership page main chart uses capability-by-tier comparison.
- Existing role-shell, membership, and multi-student isolation e2e anchors still pass.

## Current Not Completed

- U1 only refactored the three key role-shell surfaces plus left navigation.
- Secondary pages such as diagnosis, timeline detail, compare, and some admin pages are not visually converged yet.
- Mobile polish exists only as a validation pass, not as a dedicated refinement round.
- External real-provider stability is still not guaranteed; the system may fall back to mock diagnosis during demos.

## Screenshot Output

Latest acceptance screenshots are stored at:

- `artifacts/u1-acceptance/parent-overview-desktop.png`
- `artifacts/u1-acceptance/student-home-desktop.png`
- `artifacts/u1-acceptance/membership-desktop.png`
- `artifacts/u1-acceptance/parent-overview-mobile.png`

## Next Candidate

The next round should be explicitly chosen before coding:

- `U1.1`: light polish for mobile, spacing, copy consistency, and secondary-surface convergence
- `A7`: capability round on top of the current role shell baseline

## Constraints Still In Force

- Do not build official payment / subscription charging yet.
- Do not introduce worker / cron yet.
- Do not do large-scale base-layer refactor.
- Do not change role-shell backend contracts unless a future sprint explicitly says so.
- Keep multi-student isolation and role isolation intact.
