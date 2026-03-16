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
- manual admin run + lightweight in-app trigger
- dedicated A7 end-to-end acceptance

Minimum A7 rules for this round:

- student inactivity: no upload for continuous N days
- overdue recheck: recheck task due but not completed
- repeated unstable error: repeated error tag keeps returning and is not stabilized
- parent followup pending: evidence / continue-tracking signals happened but no decision yet

Minimum A7 event buckets for this round:

- students to remind
- students due for recheck
- parents due for followup
- operations attention items

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
- Admin can manually run Heartbeat once inside the current app.
- Heartbeat can also refresh from lightweight in-app triggers without worker/cron.
- Dedicated A7 Playwright coverage exists.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm exec playwright test` passes.
- Round handoff is updated and feature branch is pushed to both remotes.

