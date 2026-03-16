# Decisions

Last updated: 2026-03-17

## 2026-03-16

### Make U1 the next single objective

- Decision: the next round shifts from feature expansion to U1 visual and information reduction.
- Reason: current product capability is already broad enough for a local MVP, but page expression still feels like a functional backend instead of a clear product surface.

### Prioritize information convergence over new business logic

- Decision: U1 should not add new business logic; it should only restructure page hierarchy, copy, navigation grouping, and chart expression.
- Reason: the biggest current user-facing gap is not missing capability but overloaded presentation, mixed priorities, and weak role separation.

### Parent page should answer value, student page should answer action

- Decision: parent-facing first screens should emphasize why continued tracking matters, while student-facing first screens should emphasize what to do now.
- Reason: the same data should not be presented with the same goal for both roles.

### Keep only four first-level information blocks per key page

- Decision: parent overview and student home should each keep only four first-level cards on the first screen.
- Reason: too many same-weight modules make the page slower to understand and weaken the main decision signal.

### Use low-cost charts only

- Decision: U1 should use horizontal bars, 4-week change bars, and membership comparison bars or matrix only.
- Reason: these chart forms reduce reading cost, while pie, radar, stacked, and complex line charts add interpretation burden at this stage.

### Regroup navigation by role perspective

- Decision: left navigation should be regrouped into parent view, student view, and system / operations.
- Reason: current flat functional navigation mixes goals and forces users to parse too much before acting.

### Reduce information before polishing skin

- Decision: U1 should first remove or sink noisy modules before visual refinement.
- Reason: styling cannot fix a page whose information hierarchy is still wrong.

### Keep U1 out of payment / worker / infrastructure work

- Decision: U1 explicitly stays out of payment, subscription settlement, worker, cron, and base-layer refactor.
- Reason: this round is about product readability and decision speed, not platform expansion.

## 2026-03-17

### Mark U1 as complete before any next-round switch

- Decision: U1 should be explicitly closed in docs before starting another round.
- Reason: the repository truth must show that the parent overview, student home, membership page, and left navigation refactor has already landed and passed verification.

### Prepare real-page acceptance before starting new capability work

- Decision: export current screenshots and record page-level structure before entering any next feature round.
- Reason: acceptance should be based on current shipped surfaces, not only code diff or memory.

### Keep the next-round choice between U1.1 and A7

- Decision: the next candidate is not locked yet; choose explicitly between `U1.1` and `A7`.
- Reason: there is still visible value in a light U1.1 polish pass, but the current baseline is also good enough to support capability work if the team wants to move on.

### Treat provider instability as a demo risk, not a blocker to U1 completion

- Decision: provider `429` / `Arrearage` issues are recorded as a demo stability risk, while U1 itself remains complete because the system falls back to mock diagnosis.
- Reason: the shipped product still functions end-to-end, but real-provider reliability is not stable enough to leave unaddressed before important demos.
