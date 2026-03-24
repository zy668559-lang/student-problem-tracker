# CURRENT_SPRINT

## Sprint
M1 数学交互演示模块（直播展示样板层）

## 本轮唯一目标
M1 第一批“全自动验收收口轮”：让 AI 自己完成验收与截图，只处理两页样板。

## 本轮只做什么
1. 只处理 `/showcase/function-vertex` 与 `/showcase/geometry-helper`。
2. 用 Playwright 做自动断言与自动截图，不依赖 browser extension。
3. 输出验收结论与问题清单，写入验收文档。
4. 不进入第二批页面，不新增业务功能。

## 本轮明确不做什么
1. 不改上传 / 诊断 / 审核 / 周报 / 复检主链。
2. 不改家长页 / 学生页既有业务逻辑。
3. 不做自动视频导出。
4. 不做学生个性化自动生成。
5. 不做复杂压轴综合。
6. 不做支付 / 订阅 / worker / cron。

## 执行分批
第一批：函数样板1、几何样板1（先做先验收）
第二批：函数样板2、几何样板2（第一批验收后再进入）

## 最小改动文件清单
1. `app/showcase/**` 或 `app/demo/**`
2. `components/showcase/**`（如需新增组件）
3. `public/showcase/**`（如需静态素材）
4. `tests/e2e/showcase-first-batch.spec.ts`
5. `docs/PROJECT_STATUS.md`
6. `docs/CURRENT_SPRINT.md`
7. `docs/DECISIONS.md`
8. `docs/HANDOFF.md`
9. `docs/M1_INTERACTIVE_MATH_DEMOS.md`
10. `docs/M1_FIRST_BATCH_ACCEPTANCE.md`

## 禁止改动文件清单
1. `app/api/uploads/route.ts`
2. `app/api/review/[id]/route.ts`
3. `lib/db/**`
4. `lib/types.ts`
5. `app/dashboard/page.tsx`
6. `app/parent-overview/page.tsx`
7. `app/student-home/page.tsx`
8. `app/diagnosis/[id]/page.tsx`
9. `app/weekly-report/[id]/page.tsx`
10. `app/timeline/page.tsx`
11. `app/admin/**`
12. `app/review-queue/**`
13. `app/review-draft/**`

## 本轮完成标准
1. Playwright 自动断言通过：页面可打开、标题出现、主画布出现、说明区出现、按钮出现、无明显报错。
2. 自动生成桌面端与移动端整页截图，路径可追踪。
3. `npm run typecheck` / `npm run build` / `npm exec playwright test` 执行完成并记录结果。
4. 验收结论与问题清单写入 `docs/M1_FIRST_BATCH_ACCEPTANCE.md`。
