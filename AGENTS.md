# Repo Workflow Rules

## Read Order

Before starting any round, read:

1. `docs/PROJECT_STATUS.md`
2. `docs/CURRENT_SPRINT.md`
3. `docs/HANDOFF.md`
4. `docs/OPENCLAW_ADAPTATION.md`
5. `docs/DECISIONS.md`

## Default Execution Rules

- One round should have one main objective.
- Do not mix feature delivery with payment, worker, cron, or broad infrastructure work unless the sprint explicitly says so.
- Prefer minimal extension of existing tables, APIs, and pages over platform rewrites.
- Keep multi-student isolation and role isolation intact.

## Verification Rules

Every implementation round must finish with:

- `npm run typecheck`
- `npm run build`
- `npm exec playwright test`

Do not claim a round is complete without all three.

## Git Rules

- Work on the current feature branch.
- Commit changes for the round.
- Push to both:
  - `github/<feature-branch>`
  - `gitee/<feature-branch>`
- Do not merge `main` during the round.
- Do not push directly to `main`.

## Handoff Rules

- Update `docs/HANDOFF.md` at the end of the round.
- Update `docs/PROJECT_STATUS.md` if stage truth changed.
- If strategic direction changed, update `docs/DECISIONS.md`.

## Scope Rules

- Prefer repository truth files over screenshots or out-of-band notes.
- If the sprint says "not a feature round", keep it that way.
- If a change needs a new rule, write it into docs or skills instead of leaving it implicit.
