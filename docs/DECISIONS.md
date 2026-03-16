# Decisions

Last updated: 2026-03-16

## 2026-03-16

### Keep payment out of the next round

- Decision: do not do official payment / subscription charging before A7.
- Reason: A6 already established real membership state, but the product still needs a lighter recurring behavior layer before billing semantics.

### Keep worker / cron out of the next round

- Decision: do not introduce standalone worker / cron before A7.
- Reason: Heartbeat Lite should first prove its rule layer and operating value inside the existing app flow before infrastructure expansion.

### Make A7 the next single objective

- Decision: the next round should focus only on A7 Heartbeat Lite.
- Reason: after A6 membership state management, the highest-leverage next step is turning evidence, recheck, and membership signals into a recurring heartbeat layer.

### Why A7 before payment or worker

- Decision: prioritize product rhythm over monetization plumbing and infrastructure.
- Reason:
  - payment without a stronger heartbeat loop would monetize a still-thin recurring product story
  - worker / cron before clear heartbeat rules would harden the wrong abstraction too early
  - A7 can reuse current evidence, followup, recheck, and membership signals with lower risk

### Keep one primary objective per round

- Decision: continue one-main-goal execution.
- Reason: this repository has been more stable when each round stays single-threaded.

### Keep feature-branch delivery and avoid touching main

- Decision: continue all implementation on `feature/mvp-init` or later feature branches, without merging `main` during the round.
- Reason: current collaboration and verification flow is already branch-based and stable.
