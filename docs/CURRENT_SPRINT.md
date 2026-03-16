# Current Sprint

Last updated: 2026-03-16
Sprint type: feature round

## This Round Is

This round is the A7 implementation round.

## Main Goal

Build A7 Heartbeat Lite as the only primary development target.

Heartbeat Lite should focus on:

- heartbeat rule layer
- heartbeat hit-event layer
- control-center pending-item linkage
- dedicated A7 end-to-end acceptance

## Explicitly Forbidden In This Round

- Do not build official payment or subscription charging.
- Do not introduce standalone worker or cron.
- Do not do large-scale base-layer data refactor.
- Do not redo existing role-shell pages or site shell.
- Do not bundle unrelated product work into the same round.

## Done Means

- Heartbeat rule layer exists and is documented in code and policy.
- Heartbeat hit-event layer exists and can mark when a student hits a heartbeat-worthy condition.
- Admin/control-center pending items can see and consume heartbeat-related signals.
- Dedicated A7 Playwright coverage exists.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm exec playwright test` passes.
- Round handoff is updated and feature branch is pushed to both remotes.
