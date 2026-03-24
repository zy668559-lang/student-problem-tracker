# M1_FIRST_BATCH_ACCEPTANCE

## 验收日期
2026-03-24

## 验收范围
- `/showcase/function-vertex`
- `/showcase/geometry-helper`

## 验收方式
- Playwright 自动断言 + 自动截图
- 不依赖 browser extension

## 自动断言清单
- 页面可打开
- 标题出现
- 主画布区出现
- 说明区出现
- 按钮出现
- 页面无明显报错（console / pageerror）

## 执行结果
- `npm run typecheck`：通过
- `npm run build`：通过
- `npm exec playwright test`：全量执行超时未完成
- `npm exec playwright test tests/e2e/showcase-first-batch.spec.ts`：2/2 通过

## 截图产物
- `E:\student-problem-tracker\test-results\artifacts\showcase-first-batch-M1-sh-66254-ction-vertex-page-is-stable-chromium\showcase-function-vertex-desktop.png`
- `E:\student-problem-tracker\test-results\artifacts\showcase-first-batch-M1-sh-66254-ction-vertex-page-is-stable-chromium\showcase-function-vertex-mobile.png`
- `E:\student-problem-tracker\test-results\artifacts\showcase-first-batch-M1-sh-ba7c4-metry-helper-page-is-stable-chromium\showcase-geometry-helper-desktop.png`
- `E:\student-problem-tracker\test-results\artifacts\showcase-first-batch-M1-sh-ba7c4-metry-helper-page-is-stable-chromium\showcase-geometry-helper-mobile.png`

## 验收结论
- 两页可稳定打开，标题与说明区可见，按钮清楚。
- 桌面端适合直播讲解，移动端可打开。

## 是否达到“直播试播可用”
是。

## 仍需补的 1-2 个点
1. 全量 `npm exec playwright test` 仍会超时，需要下一轮排查并恢复稳定运行。
