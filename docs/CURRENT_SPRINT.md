# CURRENT_SPRINT

## Sprint
M1 数学交互演示模块（直播展示样板层）

## 本轮唯一目标
做 4 个直播可展示的数学交互理解卡样板，只新增 `/showcase` 或 `/demo` 层，用于证明“陈老师真的能看见孩子的数学卡点，并且能演示为什么会卡”。

## 本轮只做什么
1. 函数样板1：顶点 / 开口 / 平移
2. 函数样板2：图像和条件连线
3. 几何样板1：辅助线什么时候该出
4. 几何样板2：证明骨架
5. 仅新增展示层页面与样板文案，不进入主产品主链。

## 本轮明确不做什么
1. 不改上传 / 诊断 / 审核 / 周报 / 复检主链。
2. 不改家长页 / 学生页既有业务逻辑。
3. 不做自动视频导出。
4. 不做学生个性化自动生成。
5. 不做复杂压轴综合。
6. 不做支付 / 订阅 / worker / cron。

## 最小改动文件清单
1. `app/showcase/**` 或 `app/demo/**`（新增）
2. `components/showcase/**`（如需新增组件）
3. `public/showcase/**`（如需静态素材）
4. `docs/PROJECT_STATUS.md`
5. `docs/CURRENT_SPRINT.md`
6. `docs/DECISIONS.md`
7. `docs/HANDOFF.md`
8. `docs/M1_INTERACTIVE_MATH_DEMOS.md`

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
1. `docs/M1_INTERACTIVE_MATH_DEMOS.md` 明确 4 个页面的演示内容、结构、按钮、口语化文案与 30 秒讲法。
2. 4 个演示页只出现在 `/showcase` 或 `/demo`，不进入主产品主链。
3. 桌面端优先可用，移动端可打开不崩。
4. 不触碰上传 / 诊断 / 审核 / 周报 / 复检主链与既有家长 / 学生逻辑。
5. 实施完代码后需补齐 `npm run typecheck` / `npm run build` / `npm exec playwright test`。

## ????
????????1?????1???????
????????2?????2???????????
