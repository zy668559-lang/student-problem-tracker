# Decisions

Last updated: 2026-03-16

## 2026-03-16

### Keep payment out of current product stage

- Decision: do not build official payment / subscription charging yet.
- Reason: current priority is controllable capability boundaries and workflow stability, not billing.

### Keep worker / cron out of current product stage

- Decision: do not introduce standalone worker / cron yet.
- Reason: current weekly / recheck / followup loops are still MVP-scale and can stay app/manual.

### Treat documentation and workflow switching as a dedicated round

- Decision: dedicate a non-feature round to repository truth files and working rules.
- Reason: future rounds should start from repo documents, not screenshot relay or hidden context.

### Keep one primary objective per round

- Decision: default to one main objective per round.
- Reason: this repository has already shown better delivery quality when scope is single-threaded.

### Keep feature-branch delivery and avoid touching main

- Decision: continue all implementation on `feature/mvp-init` or future feature branches, without merging `main` during the round.
- Reason: current collaboration and verification flow is already branch-based and stable.

### Next candidate after the workflow round

- Decision: treat A7 Heartbeat Lite as the next likely candidate.
- Reason: after A6 membership state management, the next natural layer is lightweight recurring heartbeat framing, not payment infrastructure.
