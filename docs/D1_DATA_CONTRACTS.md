# D1 Data Contracts

## Goal
把“自动抓取草稿”和“正式学生档案写库”拆成两段，形成可扩展但本轮仍是同步执行的最小合同。

## Contract 1: intake draft
自动抓取后的落点不是正式 `diagnoses`，而是 staging draft。

### Draft fields
- `id`: draft 主键
- `student_id`: 必填，学生作用域
- `parent_account_id`: 必填，家长账号作用域
- `subject` / `module`: 当前上传学科与模块
- `submission_type`: `diagnosis | recheck`
- `source_recheck_task_id`: 复检上传时回挂原任务
- `upload_type` / `file_name` / `file_path`: 原始素材信息
- `score_note` / `note` / `student_self_report`: 原始文字输入
- `stuck_point_choice` / `stuck_point_source` / `steps_text` / `has_steps` / `step_quality`
- `diagnosis_mode`: `quick | standard | deep`
- `draft_payload_json`: AI 初判 JSON
- `review_status`: `pending | edited | approved | rejected`
- `review_notes`: 审核备注
- `review_diff_json`: 审核改动差异
- `official_upload_id` / `official_diagnosis_id` / `official_weekly_report_id`: 审核通过后的正式实体 id
- `materialized_at`: 正式写库时间
- `created_at` / `updated_at`

## Contract 2: review action
审核动作只作用在 draft 上。

### Request
- route: `PATCH /api/review/:draftId`
- body:
  - `action`: `approve | edit | reject`
  - `payloadText`: 当前审核版 JSON 文本
  - `reviewNotes`: 审核备注

### Response
- `ok`
- `reviewStatus`
- `draftId`
- `officialDiagnosisId`: 仅 `approve` 后返回
- `officialWeeklyReportId`: 仅 `approve` 后返回
- `recheckTaskId`: 审核通过且生成复检任务时返回

## Contract 3: materialize
只有 `approve` 才允许从 draft materialize 到正式学生档案。

### Writes on approve
1. 正式 `uploads`
2. 正式 `diagnoses`
3. `repair_tasks`
4. `change_logs`
5. `recheck_tasks` 同步
6. `weekly_reports`
7. `student_memory`
8. `heartbeat` 同步
9. `admin_action_logs` 审计

### Must not happen before approve
- 不得提前创建正式 `diagnosis`
- 不得提前创建正式 `repair_task`
- 不得提前刷新正式 `weekly_report`
- 不得提前把草稿塞进学生前台诊断入口

## Contract 4: admin review queue
管理员审核队列统一读 staging draft。

### Queue item fields
- `id`: draft id
- `studentName`
- `subject`
- `module`
- `reviewStatus`
- `confidence`
- `createdAt`
- `payload`
- `reviewNotes`
- `officialDiagnosisId`

### Queue links
- draft 链接：`/review-draft/:id`
- 正式诊断链接：仅在已 materialize 时显示 `/diagnosis/:officialDiagnosisId`

## Contract 5: scope boundary
- draft 和审核动作必须绑定 `student_id` / `parent_account_id`
- 不改现有多学生隔离逻辑
- 不引入 worker / cron
- 本轮全部同步完成，不做异步总线
