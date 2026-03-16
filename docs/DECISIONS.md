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

### A7 uses a lightweight rule + event model

- Decision: A7 should introduce a lightweight heartbeat rule layer and heartbeat hit-event layer inside the current app.
- Reason: the product now needs inspectable recurring attention signals, but not a separate scheduling system yet.

### A7 heartbeat must reuse existing product signals

- Decision: heartbeat should consume existing upload, recheck, evidence, weekly report, followup, membership, and result-event signals instead of creating a parallel truth source.
- Reason: this keeps A7 inspectable, low-risk, and aligned with current student-scoped data isolation.

### A7 execution stays manual + in-app for now

- Decision: this round only supports admin manual run and lightweight in-app trigger points for heartbeat refresh.
- Reason: heartbeat rules should be proven in current app flow before adding cron/worker infrastructure.

### A7 control-center linkage stays additive

- Decision: heartbeat pending items should be linked into the existing control center instead of creating a new admin console.
- Reason: A4/A6 already landed a lightweight control center; A7 only needs to surface new recurring attention signals there.

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

