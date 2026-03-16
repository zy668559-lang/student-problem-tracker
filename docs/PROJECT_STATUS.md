# Project Status

Last updated: 2026-03-17
Branch baseline: `feature/mvp-init`

## Current Summary

- Product stage: local MVP with parent/student/admin three-side shell, real membership state management, and Heartbeat Lite.
- Latest verification baseline:
  - `npm run typecheck`: passed
  - `npm run build`: passed
  - `npm exec playwright test`: passed (`30 passed`)
- Remote branch status:
  - `github/feature/mvp-init`
  - `gitee/feature/mvp-init`

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

### Explicitly Forbidden For Current Scope

- Do not rebuild the diagnosis base or replace the current review pipeline.

## A2 Access / Admin Base

### Completed

- Trial whitelist and quota management.
- Admin area with role isolation.
- Admin assets CRUD and operations log.

### Partially Completed

- Weekly scheduler is visible and can be manually rerun, but it is still application-hosted.

### Not Completed

- No standalone customer-service / sales workflow system.

### Explicitly Forbidden For Current Scope

- Do not rebuild admin base or introduce a large new admin framework.

## A3 Multi-Student / Permission Isolation

### Completed

- Multi-student switching under one parent account.
- Student-scoped isolation for uploads, diagnoses, weekly reports, evidence, followups, and membership.
- Admin vs parent permission isolation.

### Partially Completed

- Only two roles are modeled in practice: `parent` and `admin`.

### Not Completed

- No sub-roles such as sales, coach, reviewer, or operations specialist.

### Explicitly Forbidden For Current Scope

- Do not redo role architecture or redesign the permission substrate.

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

### Explicitly Forbidden For Current Scope

- Do not introduce standalone worker / cron in current phase.

## A5 Role Shell

### Completed

- Student home page.
- Parent overview page.
- Membership tier page.
- Clear linking between role shell pages, timeline, funnel, and continue-tracking entry.
- U1 first-screen restructuring for parent overview and student home.
- U1 navigation regrouping by parent / student / system view.

### Partially Completed

- Membership page was initially presentation-only; it now depends on A6 for real status.
- U1 only refactored the key role-shell surfaces, not every secondary page.

### Not Completed

- No payment-backed subscription flow.
- Secondary pages still need later visual convergence if U1 is extended.

### Explicitly Forbidden For Current Scope

- Do not redo the role shell or replace site navigation wholesale.

## A6 Membership State Management

### Completed

- Real membership state model per `student_id`.
- Three tiers: `trial`, `self_service`, `coaching`.
- State fields: `membership_tier`, `tier_status`, `effective_from`, `effective_to`, `benefit_flags`, `manual_override_reason`, `updated_at`.
- Real benefit gating for upload allowance, recheck, weekly report, timeline, teacher correction, and CTA copy.
- Admin manual actions: open, extend, downgrade, pause.
- Membership action logs with operator, before/after state, time, and note.
- Page linkage across student home, parent overview, membership, continue-tracking, and timeline.
- U1 membership page now explains tier differences with a capability comparison chart.

### Partially Completed

- Membership lifecycle is manually managed; there is no automated renewal / expiry worker.
- Legacy `trial_access` compatibility is kept and synchronized, but it is not the primary source of truth anymore.

### Not Completed

- No formal billing, payment, subscription settlement, invoice, or renewal mechanism.

### Explicitly Forbidden For Current Scope

- Do not add official payment / subscription system yet.

## A7 Heartbeat Lite

### Completed

- Lightweight heartbeat rules and inspectable events.
- Admin manual run and in-app trigger without standalone worker/cron.
- Control-center pending linkage for reminder / recheck / followup queues.
- Dedicated heartbeat e2e coverage.

### Not Completed

- No standalone cron / worker.
- No dedicated heartbeat operations workbench yet.

### Explicitly Forbidden For Current Scope

- Do not expand Heartbeat into a full automation platform yet.

## Cross-Stage Forbidden Items

- No official payment or subscription charging.
- No standalone worker / cron.
- No rebuild of admin base, role shell, recheck base, or multi-student base.
- No large schema rewrite.
- No direct work on `main`; keep work on feature branches.

## Suggested Next Candidate

- Define the next round explicitly before coding.
- If continuing design refinement, focus on mobile polish and secondary-page convergence.
- If switching back to capability delivery, keep payment and worker/cron out unless the sprint says otherwise.
