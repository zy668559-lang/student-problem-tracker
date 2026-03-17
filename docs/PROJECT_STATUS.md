# Project Status

Last updated: 2026-03-17
Branch baseline: `feature/mvp-init`

## Current Summary

- Product stage: local MVP with parent / student / admin shells, real membership state management, and Heartbeat Lite.
- U1 visual and information reduction: completed.`r`n- U1.1 light polish: completed.
- Latest verification baseline:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`30 passed`)
- Latest remote status:
  - `github/feature/mvp-init`: pushed
  - `gitee/feature/mvp-init`: pushed

## A1 Core MVP

### Completed

- Login and role-based session flow.
- Upload -> diagnosis -> review -> weekly report main chain.
- Chen-teacher conversational copy for parent-facing summaries.
- Parent dashboard and subject entry pages.

### Partially Completed

- AI provider fallback is available, but production model stability still depends on external quota.

### Not Completed

- No heavy attachment preview or richer media evidence experience.

## A2 Access / Admin Base

### Completed

- Trial whitelist and quota management.
- Admin area with role isolation.
- Admin assets CRUD and operations log.

### Partially Completed

- Weekly scheduler is visible and can be manually rerun, but it is still application-hosted.

### Not Completed

- No standalone customer-service / sales workflow system.

## A3 Multi-Student / Permission Isolation

### Completed

- Multi-student switching under one parent account.
- Student-scoped isolation for uploads, diagnoses, weekly reports, evidence, followups, and membership.
- Admin vs parent permission isolation.

### Partially Completed

- Only two roles are modeled in practice: `parent` and `admin`.

### Not Completed

- No sub-roles such as sales, coach, reviewer, or operations specialist.

## A4 Recheck / Evidence / Conversion Ops

### Completed

- Real recheck chain with task creation, progress, stabilization, and writeback.
- Compare page, evidence timeline, followup funnel, continue-tracking offer page.
- Lightweight admin control center.
- Continue-tracking intent and activation path.

### Partially Completed

- Weekly batch scheduler is still app/manual, not independent.
- Followup funnel is lightweight and not full CRM automation.

### Not Completed

- No worker / cron deployment.
- No automated sales SOP or deep conversion experiments.

## A5 Role Shell

### Completed

- Student home page.
- Parent overview page.
- Membership tier page.
- Clear linking between role-shell pages, timeline, funnel, and continue-tracking entry.
- U1 first-screen restructuring for parent overview, student home, and membership page.
- U1 navigation regrouping by parent / student / system view.
- U1 chart semantics aligned to four-state bars, 4-week change bars, and tier comparison.

### Partially Completed

- U1 only refactored the key role-shell surfaces, not every secondary page.

### Not Completed

- No payment-backed subscription flow.
- Secondary surfaces still need later visual convergence if U1 is extended further.

## A6 Membership State Management

### Completed

- Real membership state model per `student_id`.
- Three tiers: `trial`, `self_service`, `coaching`.
- Real benefit gating for upload allowance, recheck, weekly report, timeline, teacher correction, and CTA copy.
- Admin manual actions and membership action logs.
- U1 membership page now explains tier differences with a capability comparison chart.

### Partially Completed

- Membership lifecycle is manually managed; there is no automated renewal / expiry worker.
- Legacy `trial_access` compatibility is kept and synchronized, but it is not the primary source of truth anymore.

### Not Completed

- No formal billing, payment, subscription settlement, invoice, or renewal mechanism.

## A7 Heartbeat Lite

### Completed

- Lightweight heartbeat rules and inspectable events.
- Admin manual run and in-app trigger without standalone worker/cron.
- Control-center pending linkage for reminder / recheck / followup queues.
- Dedicated heartbeat e2e coverage.

### Not Completed

- No standalone cron / worker.
- No dedicated heartbeat operations workbench yet.

## Current Open Items

- U1 mobile polish and secondary-page convergence are not finished.
- Demo stability still depends on whether the external real provider is healthy.
- No official payment / subscription charging.
- No standalone worker / cron.

## Suggested Next Candidate

- `U1.1`: light visual polish, mobile refinement, copy consistency, and secondary-page convergence
- `A7`: if the next round should switch back to capability delivery on top of the current UI baseline
