# A5 Role Shell Handoff

## 当前已完成模块清单
- 本地 MVP 主链：登录 -> 上传 -> 诊断 -> 审核 -> 周报 -> 变化回写。
- 数学 / 英语双学科基础模块与家长后台展示。
- 白名单试用机制：邀请码 / 白名单手机号 / 次数限制 / 图片数限制 / 年级科目开关。
- 多学生隔离：一个家长账号绑定多个孩子，上传、诊断、周报、记忆、复检按 `student_id` 隔离。
- 管理员权限隔离：仅管理员可访问 `/admin/*`，后台操作带基础操作日志。
- 复检闭环：`recheck_tasks` 真正运行，支持触发规则、稳住判定、下轮优先级、回写 `student_memory / change_logs / weekly_reports`。
- 结果对比页、证据时间轴页、轻量跟进漏斗页、继续追踪意向与开通状态。
- 试用转化收口层：独立 `/continue-tracking` 收口页与收口页行为埋点。
- 后台控制中心首页（轻版）：今日待回访 / 待复检 / 待审核 / 高意向 / 周报状态 / 模型成本。
- Playwright 自动验收已覆盖主链、后台、多学生、复检、时间轴、跟进漏斗、收口页、控制中心。

## 当前核心页面与路由
### 家长端 / 学生侧
- `/login`
- `/dashboard`
- `/upload`
- `/subject/math`
- `/subject/english`
- `/diagnosis/[id]`
- `/weekly-report/[id]`
- `/recheck/[id]`
- `/compare/[id]`
- `/timeline`
- `/continue-tracking`

### 后台 / 管理端
- `/admin`
- `/admin/whitelist`
- `/admin/students`
- `/admin/recheck-tasks`
- `/admin/assets`
- `/admin/operations`
- `/admin/followups`
- `/admin/follow-ups`（兼容旧入口）

### 关键 API
- `/api/auth/login`
- `/api/logout`
- `/api/uploads`
- `/api/review/[id]`
- `/api/result-events`
- `/api/tracking-intents`
- `/api/students/switch`
- `/api/admin/trial-access/[id]`
- `/api/admin/recheck-tasks/[id]`
- `/api/admin/assets`
- `/api/admin/assets/[id]`
- `/api/admin/weekly-batch`
- `/api/admin/followups/[id]`
- `/api/admin/follow-ups/[id]`
- `/api/admin/tracking-intents/[id]`

## 当前已落地的数据表与关键字段
### 核心业务表
- `users`
  - `role`, `email`, `phone`
- `students`
  - `user_id`, `name`, `grade`, `school`
- `uploads`
  - `student_id`, `subject`, `module`, `score_note`, `student_self_report`
  - `stuck_point_choice`, `stuck_point_source`
  - `steps_text`, `has_steps`, `step_quality`
  - `image_count`, `diagnosis_mode`
  - `submission_type`, `source_recheck_task_id`
- `diagnoses`
  - `upload_id`, `subject`, `module`, `current_stage`, `problem_tags`, `repair_actions`, `parent_summary`, `confidence`, `review_status`
  - `draft_diagnosis`, `approved_diagnosis`, `review_notes`, `review_diff`
  - `diagnosis_mode`, `prompt_version`
  - `recheck_task_id`, `recheck_status`, `recheck_outcome`, `recheck_summary`
  - `next_priority`, `next_recheck_reason`, `next_action_type`, `continue_tracking_reason`
  - `stabilized`, `student_today_action`, `student_minimum_action`, `student_self_check`
- `repair_tasks`
- `weekly_reports`
  - `student_id`, `report_json`
  - `report_mode`, `batch_generated_at`, `student_report_json`, `continue_tracking_recommended`
- `change_logs`
  - `student_id`, `subject`, `module`, `change_type`, `description`, `related_diagnosis_id`
  - `new_issues`, `stabilized_issues`, `unstable_issues`, `repeated_error_tags`, `evidence_summary`
  - `recheck_task_id`, `repeat_count_7d`, `repeat_count_30d`, `last_seen_at`, `last_recheck_at`, `stabilized_score`
  - `next_priority`, `next_recheck_reason`, `next_action_type`, `stabilized`

### 试用 / 记忆 / 素材 / 模型
- `trial_access`
  - `user_id`, `student_id`, `phone`, `invite_code`, `whitelist_enabled`
  - `free_trial_total`, `free_trial_used`, `max_images_per_upload`
  - `enabled_grades`, `enabled_subjects`
  - `paid_tracking_enabled`, `tracking_status`
- `student_memory`
  - `student_id`, `stable_tags`, `repeated_error_tags`, `last_3_weeks_focus`
  - `last_best_improvement`, `next_priority`, `next_recheck_reason`, `next_action_type`
  - `recheck_status_summary`, `last_recheck_at`, `preferred_tone`, `updated_at`
- `skill_assets`
  - `subject`, `module`, `tag`, `difficulty`, `asset_type`, `title`, `summary`
  - `file_url`, `preview_url`, `use_stage`, `paid_only`
- `model_call_logs`
  - `student_id`, `upload_id`, `provider`, `model_name`, `diagnosis_mode`, `prompt_version`
  - `input_size`, `output_size`, `estimated_cost`, `latency_ms`, `success`, `error_code`, `retry_count`
- `result_page_events`
  - `student_id`, `diagnosis_id`, `event_name`, `asset_id`, `event_value`, `created_at`

### 复检 / 意向 / 调度 / 跟进 / 管理日志
- `recheck_tasks`
  - `student_id`, `diagnosis_id`, `weekly_report_id`
  - `subject`, `module`, `tag`, `status`
  - `trigger_type`, `trigger_reason`
  - `repeat_count_7d`, `repeat_count_30d`, `last_seen_at`, `last_recheck_at`, `stabilized_score`, `stabilized`
  - `next_priority`, `next_recheck_reason`, `next_action_type`, `continue_tracking_reason`
  - `paid_tracking_enabled`, `diagnosis_mode`, `last_outcome`, `attempt_count`, `pass_streak`
  - `manual_override_status`, `manual_override_reason`, `manual_override_priority`, `manual_override_by`, `manual_override_at`
- `tracking_intents`
  - `student_id`, `diagnosis_id`, `recheck_task_id`, `source`, `status`, `requested_weeks`, `note`, `submitted_at`, `activated_at`
- `followup_leads`
  - `tracking_intent_id`, `parent_account_id`, `student_id`, `source_type`, `source_ref_id`
  - `grade`, `subject`, `module`
  - `latest_evidence_summary`, `latest_block_point`, `weekly_change_summary`, `unstable_step`, `continue_tracking_reason`
  - `status`, `last_contact_at`, `next_follow_up_at`, `latest_action_type`, `latest_action_summary`, `follow_up_note`, `rejection_reason`
- `followup_actions`
  - `lead_id`, `operator_user_id`, `action_type`, `note`, `remind_at`
- `weekly_batch_scheduler`
  - `job_name`, `interval_minutes`, `next_run_at`, `last_run_at`, `last_status`, `last_error`, `last_report_count`
- `weekly_batch_runs`
  - `job_name`, `trigger_source`, `triggered_by`, `status`, `report_count`, `error_message`, `started_at`, `finished_at`
- `lead_followups`
  - 历史轻量跟进兼容表，现主要由 `followup_leads` 承接新逻辑
- `admin_action_logs`
  - `actor_user_id`, `action_type`, `target_type`, `target_id`, `detail`, `created_at`

## 当前已完成的 build / e2e 状态
- `npm run typecheck`：通过
- `npm run build`：通过
- `npm exec playwright test`：通过
- 当前 Playwright 全量结果：`19/19 passed`

## 当前 feature 分支和最近提交
- 当前分支：`feature/mvp-init`
- 最近提交：`8a8df6b feat: add tracking offer page and admin control center`
- 上一提交：`fc5d312 feat: add followup sop funnel and lead tracking`
- 远程：
  - `github/feature/mvp-init`
  - `gitee/feature/mvp-init`

## 当前还未完成项
- 未做正式支付 / 订阅系统。
- 未做独立 worker / cron，周报调度仍是应用内触发 + 后台手动补跑。
- 未做销售 / 客服 SOP 自动化。
- 未做收口页 AB 深化和更细的转化策略实验。
- 未做大规模附件证据预览、时间轴多维筛选、支付后会员权益真正结算。

## 下一轮只做的范围
只做下面三块，不扩散：
- 孩子个人档案首页
- 家长后台总览页
- 会员分层页

## 下一轮禁止项
- 正式支付 / 订阅系统
- worker / cron 独立化
- AB 深化
- 后台大改
- 底层重构

## 下一轮验收标准
- 新增“孩子个人档案首页”，能按当前 `student_id` 聚合展示基本档案、核心卡点、近期变化、最近复检和下轮优先级。
- 新增“家长后台总览页”，家长能一眼看到多孩子总体状态、谁最该先盯、谁本周有变化、谁需要继续追踪。
- 新增“会员分层页”，能清楚表达试用 / 继续追踪 / 已开通等层级，不接正式支付。
- 所有新页面必须继续保持陈老师口语化家长端文案。
- 多学生不串线，管理员权限不回退。
- `npm run build` 通过。
- `npm exec playwright test` 通过，并新增对应专项验收。

## 接手建议
- 优先复用现有聚合层：`lib/db/a4.ts`、`lib/db/a43.ts`、`lib/db/followups.ts`、`lib/db/p25.ts`。
- 家长端文案继续走 `lib/services/tone-chen.ts`。
- 新页面尽量在现有数据表上聚合，不新增大表。
