# Current Sprint

Last updated: 2026-03-16
Sprint type: workflow switch round

## This Round Is

This is not a feature-development round.

This round exists to switch the repository into a fixed, document-driven workflow so future development no longer depends on screenshots or out-of-band handoff notes.

## Main Goal

Create a single-source repository workflow baseline:

- project stage is documented
- sprint scope is documented
- key decisions are documented
- next-round handoff is documented
- OpenClaw adaptation is documented
- local AGENTS rules are documented
- missing policy skills are documented

## Explicitly Forbidden In This Round

- No new product feature scope.
- No payment / subscription implementation.
- No worker / cron work.
- No rebuild of admin base, membership base, role shell, recheck base, or multi-student base.
- No opportunistic UI redesign.

## Done Means

- `docs/PROJECT_STATUS.md` is current through A6.
- `docs/OPENCLAW_ADAPTATION.md` clearly states adopted / deferred / excluded parts.
- `docs/DECISIONS.md` records current strategic choices.
- `docs/HANDOFF.md` is updated for the next round.
- local `AGENTS.md` exists and defines the default repo workflow.
- required policy files under `skills/` exist or are updated.
- `npm run typecheck`, `npm run build`, `npm exec playwright test` all pass.
- changes are committed and pushed to `feature/mvp-init` on both remotes.

## Next Candidate After This Round

- A7: Heartbeat Lite
