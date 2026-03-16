# Heartbeat Policy

- Heartbeat is a lightweight recurring attention layer, not a billing feature and not an infrastructure system.
- Heartbeat Lite should answer only a few recurring questions:
  - what is the main focus this week
  - which step is still unstable
  - why it still needs attention now
  - what the next action is
- Heartbeat must stay scoped by `student_id`.
- Heartbeat event records must bind both `student_id` and the owning `parent_account_id`.
- Heartbeat should consume existing evidence, recheck, weekly report, followup, and membership signals instead of creating a parallel truth source.
- Heartbeat hit events should be explicit and inspectable, so admin/control-center can see why a student entered a heartbeat-worthy state.
- Heartbeat Lite must not require payment, worker, or cron to exist first.
- Heartbeat Lite should extend existing pages and control-center signals instead of rebuilding the current shell.
- Heartbeat Lite should at least cover four recurring cases:
  - no upload for continuous N days
  - recheck due but still not completed
  - repeated unstable error tag still bouncing
  - parent viewed evidence / offer flow but still has no decision
- This round allows only two trigger styles:
  - admin manual run inside the current app
  - lightweight in-app refresh on existing write paths

