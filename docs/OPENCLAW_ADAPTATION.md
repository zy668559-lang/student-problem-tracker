# OpenClaw Adaptation

Last updated: 2026-03-16

## Adaptation Goal

Use OpenClaw as a product-development discipline, not as a large platform rewrite.

The current repository should absorb the parts that make delivery more deterministic:

- one main objective per round
- explicit capability boundaries
- explicit evidence and membership policies
- explicit handoff and decision logs
- mandatory full verification before push

## Immediately Adopted

### 1. Single-source project documents

- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_SPRINT.md`
- `docs/DECISIONS.md`
- `docs/HANDOFF.md`
- `docs/OPENCLAW_ADAPTATION.md`

These files now define the current stage, sprint, decisions, and handoff baseline.

### 2. One-primary-goal execution model

- One round should have one main product objective.
- Avoid bundling payment, worker, CRM, shell rewrite, and data refactor into the same round.

### 3. Capability-first constraints

- Membership capability boundaries are explicit and enforceable.
- Recheck loop rules and evidence rules are written as repository policies.
- Conversion and followup are treated as bounded capabilities, not broad “运营大包”.

### 4. Mandatory verification gate

Every round must finish with:

- `npm run typecheck`
- `npm run build`
- `npm exec playwright test`

### 5. Feature-branch-only delivery

- Commit to current feature branch.
- Push to `github/gitee` feature branch.
- Do not merge `main` during implementation rounds.

## Deferred To Later

These are useful OpenClaw ideas, but should be introduced after current MVP rhythm is stable.

### 1. Heartbeat Lite

- Lightweight recurring student heartbeat state.
- Better “this week / next week / still unstable” loop framing.
- Candidate next round: A7.

### 2. Capability registry deepening

- A clearer product capability matrix that maps UI, API, data, and test coverage together.
- Useful after more post-A6 capabilities accumulate.

### 3. Structured operational rituals

- More formal weekly operating cadence around followups, rechecks, and membership state review.
- Can come after Heartbeat Lite exists.

## Explicitly Not Introduced Now

- Full OpenClaw orchestration platform.
- Worker/cron mesh or event-bus infrastructure.
- Large autonomous CRM / sales automation.
- Official payment and subscription engine.
- Large schema rewrite to mimic a generic “platform” architecture.

## Current Practical Interpretation

For this project, OpenClaw means:

- tighter scope control
- clearer repository truth files
- explicit policies for membership, evidence, recheck, and conversion
- deterministic validate-and-push workflow

It does not mean:

- platformization for its own sake
- rebuilding stable layers before the product needs it
