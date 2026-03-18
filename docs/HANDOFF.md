# HANDOFF

## Read First
开始下一轮前，按这个顺序读取：
1. `docs/PROJECT_STATUS.md`
2. `docs/CURRENT_SPRINT.md`
3. `docs/HANDOFF.md`
4. `docs/OPENCLAW_ADAPTATION.md`
5. `docs/DECISIONS.md`
6. `docs/D1_DATA_CONTRACTS.md`

## Current Repository State
- 分支：`feature/mvp-init`
- 当前状态：`D1 数据接口清单 + 自动录入待审核队列 + 人工审核确认流` 已完成
- 当前验证：`npm run typecheck`、`npm run build`、`npm exec playwright test` 全部通过（`30 passed`）

## D1 已完成什么
1. 上传接口现在只生成 staging draft，不再直接写正式学生档案。
2. 新增 `review_drafts` 作为草稿实体，承接自动抓取结果、审核状态、审核差异和 materialize 回填结果。
3. 审核队列已切到 draft 视角：`/review-queue`、`/review-draft/[id]`、`/api/review/[id]` 都围绕 draft id 运转。
4. 审核通过后才正式写入 `uploads / diagnoses / repair_tasks / weekly_reports`，并补齐审计日志、变更日志、recheck / heartbeat 同步。
5. 管理端待审核入口和控制中心已切到 draft，而不是正式 diagnosis。
6. D1 相关 e2e 已切到“上传 -> draft -> 管理员审核 -> 正式 diagnosis”的闭环，并已全量通过。

## Important Notes
- 试用次数现在在创建 draft 时就会消耗，正式 materialize 时不会重复增加。
- D1 e2e 已显式恢复 parent 的 `activeStudentId`，避免管理员审核后回到默认学生造成多学生串线假象。
- 本轮没有做 worker / cron，没有做支付 / 订阅，也没有把新的前台大改混进 D1。

## Cleanup Notes
- 旧的 `artifacts/u11-review/` 已按过期截图处理，不再保留在工作区。
- `next-start*.txt` 归类为本地临时启动日志，已加入 `.gitignore`，避免继续污染工作区。

## Recommended Next Round
下一轮建议进入：`A7 Heartbeat Lite`

原因：
1. D1 已经把“草稿进队列 -> 审核 -> 正式入库”的底座站住。
2. 当前最自然的下一步，是把已有诊断 / 复检 / 跟进 / 审核信号接成主动发现与待处理队列。
3. A7 可以直接复用 D1 产出的正式入库结果，不需要再回头重拆上传链。