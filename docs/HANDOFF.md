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
- Current target: U1 visual and information reduction
- U1 status: implementation completed for parent overview, student home, membership page, and left navigation grouping
- Latest verification baseline:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`30 passed`)

## U1 Completion Snapshot

- Parent overview first screen is reduced to four first-level blocks:
  - 当前最卡
  - 这周先做
  - 还没稳的一步
  - 继续追踪理由
- Student home first screen is reduced to four first-level blocks:
  - 今天先练这个
  - 最近一次结果
  - 本周重点
  - 下次复检什么
- Membership page now centers on tier differences instead of long-form explanation.
- Left navigation is regrouped into parent view, student view, and system / operations.
- Charts follow the U1 rule set:
  - parent overview main chart uses four-state horizontal rails
  - parent overview secondary chart uses 4-week change bars
  - membership page main chart uses capability x tier comparison
- Existing role-shell and membership e2e anchors remain intact.
- No backend contract, API route, membership base table, or multi-student substrate was changed.

## Constraints Still In Force

- Do not build official payment / subscription charging yet.
- Do not introduce worker / cron yet.
- Do not do large-scale base-layer refactor.
- Do not change backend contracts for role shell pages unless a future sprint explicitly says so.
- Keep multi-student isolation and role isolation intact.

## Recommended Next Round

- Next round should be defined explicitly before coding.
- If continuing product refinement, prefer:
  - mobile and small-screen polish for U1 surfaces
  - visual consistency cleanup for secondary pages
  - copy convergence on remaining legacy pages
- If switching to a new capability round, write the boundary into `docs/CURRENT_SPRINT.md` first.

## Operating Rule

Before ending any future round:

- update `docs/HANDOFF.md`
- update `docs/PROJECT_STATUS.md` if stage truth changed
- run `typecheck`, `build`, and full `playwright`
- commit and push feature branch to both remotes
