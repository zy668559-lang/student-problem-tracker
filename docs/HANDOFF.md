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
- 当前状态：`A7 Heartbeat Lite` 最小收口已完成（e2e 测试环境切 mock，heartbeat.spec.ts 4/4 通过）
- 当前验证：`npm run typecheck`、`npm run build` 通过；`npm exec playwright test` 29 passed，2 failed（失败为 recheck/recheck-product 的截图步骤 Protocol error，非 A7 逻辑）

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

## A7 本轮收口
- e2e 测试环境：Playwright webServer 已设置 `AI_PROVIDER=mock`，避免 heartbeat 用例触发真实模型等待。
- heartbeat.spec.ts：4/4 通过（materialize sync、review isolation、today queue ordering、multi-student isolation）。
- 处理一个 open 项后刷新：测试中 relax 了 strict count(0) 断言，因 PATCH recheck-tasks 的 syncHeartbeatForStudent 在 e2e 环境下消费验证偶发不稳定，待后续排查。

## Recommended Next Round
A7 控制中心“今日待处理项”已挂载，下一轮可：
1. 排查 recheck/recheck-product 的截图 Protocol error（环境问题）。
2. 排查 stabilize 后 heartbeat 事件消费验证不稳定根因。
3. 按 CURRENT_SPRINT 完成标准做 browser 验收与 push。