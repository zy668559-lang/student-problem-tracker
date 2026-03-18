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
- 当前轮次：`D1 数据接口清单 + 自动录入待审核队列 + 人工审核确认流`
- 当前状态：D1 已完成，代码 / 文档 / e2e 已收口并通过全量验证

## D1 已落地什么
1. 上传接口现在只生成 staging draft，不再直接写正式学生档案。
2. 新增 `review_drafts` 作为草稿实体，沉淀自动抓取结果、审核状态、审核差异和 materialize 回填结果。
3. 审核队列已改成基于 draft 工作：`/review-queue`、`/review-draft/[id]`、`/api/review/[id]` 都围绕 draft id 运转。
4. 审核通过时才正式写入 `uploads / diagnoses / repair_tasks / weekly_reports`，并补齐变更日志、审核日志和 heartbeat / recheck 同步。
5. 控制中心和管理端待审核入口已切到 draft 视角，不再把正式 diagnosis 当审核对象。
6. D1 相关 e2e 已切到“上传 -> draft -> 管理员审核 -> 正式 diagnosis”的闭环。

## 本轮关键文件
- `docs/D1_DATA_CONTRACTS.md`
- `lib/db/d1.ts`
- `app/api/uploads/route.ts`
- `app/api/review/[id]/route.ts`
- `app/review-queue/page.tsx`
- `app/review-draft/[id]/page.tsx`
- `components/review-queue-item.tsx`
- `lib/db/a43.ts`
- `lib/db/admin.ts`
- `tests/e2e/d1-review-helpers.ts`
- `tests/e2e/closure.spec.ts`
- `tests/e2e/role-shell.spec.ts`
- `tests/e2e/multi-student.spec.ts`
- `tests/e2e/timeline.spec.ts`
- `tests/e2e/recheck.spec.ts`
- `tests/e2e/recheck-product.spec.ts`
- `tests/e2e/membership-status.spec.ts`
- `tests/e2e/heartbeat.spec.ts`
- `tests/e2e/followups.spec.ts`
- `tests/e2e/conversion-control.spec.ts`
- `tests/e2e/admin.spec.ts`

## Verification
- `npm run typecheck`：通过
- `npm run build`：通过
- `npm exec playwright test`：通过（`30 passed`）

## Important Notes
- 试用次数现在在创建 draft 时就会消耗，而不是等正式 upload 落库时再消耗。
- D1 e2e 已显式恢复 parent 的 `activeStudentId` 上下文，避免管理员审核后回到默认学生，造成多学生串线假象。
- 本轮没有做 worker / cron，没有做支付 / 订阅，也没有把 Heartbeat Lite 混进 D1。

## Next Step
下一轮不要默认继续改 D1 细节，先明确一个主目标：
1. 扩展自动录入来源 / 数据接口边界
2. 补审核效率层
3. 进入新的能力轮