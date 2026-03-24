# PROJECT_STATUS

## Last Updated
2026-03-24

## Branch Baseline
`feature/mvp-init`

## Current Summary
- 当前产品阶段：本地 MVP，已具备家长 / 学生 / 管理员三侧壳、真实会员状态、复检链路、变化记录、跟进漏斗、Heartbeat Lite。
- `U1` 视觉与信息收敛轮：已完成。
- `U1.1` 轻精修轮：已完成。
- `U1.2` 前台文案口语化真收口：已完成。
- `D1 数据接口清单 + 自动录入待审核队列 + 人工审核确认流`：已完成。
- 本轮最新验证结果：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）

## 当前真相
- 上传主链已经从“自动上传后直接写正式库”切成“先写 `review_drafts` staging draft，再进审核队列”。
- `review_drafts` 已落地为 D1 草稿实体，自动抓取结果不会直接写正式 `uploads / diagnoses / repair_tasks / weekly_reports`。
- `/review-queue`、`/review-draft/[id]`、`/api/review/[id]` 已切到 draft 维度；审核通过后才 materialize 到正式学生档案。
- 审核通过时会补正式 `upload / diagnosis / recheck / weekly report`，并写管理员审计记录。
- 管理端待审核入口和控制中心已改成指向 draft，而不是正式 diagnosis。
- 多学生隔离仍保持在 `student_id` 维度；本轮全量 e2e 已覆盖并通过。

## Current Open Items
- 正式支付 / 订阅仍未做。
- 独立 worker / cron 仍未做。
- Heartbeat Lite 没纳入本轮范围，仍保持上一轮实现状态。
- 复杂消息网关集成仍未做。
- 外部真实诊断 provider 仍可能出现 `429 / Arrearage`，演示时需要按场景决定是否固定到 mock。

## Recommended Next Round
D1 已经把“草稿进队列 -> 审核 -> 正式入库”的系统底座站住。
下一轮建议先从以下方向里选一个，不要混做：
1. 自动录入来源继续扩展到更多入口 / 来源适配
2. 审核效率层优化（批量审核、差异提示、审核视图增强）
3. 新能力轮（如 Heartbeat 后续能力）