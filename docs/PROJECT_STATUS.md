# PROJECT_STATUS

## Last Updated
2026-03-17

## Branch Baseline
`feature/mvp-init`

## Current Summary
- 当前产品阶段：本地 MVP，已具备家长 / 学生 / 管理员三侧壳、真实会员状态、复检链路、证据时间轴、跟进漏斗、Heartbeat Lite。
- `U1` 视觉与信息收敛轮：已完成。
- `U1.1` 轻精修轮：已完成。
- 最新验证结果：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）
- 最新远端状态：本轮完成后将继续保持推送到 `github/gitee` 的 `feature/mvp-init`。

## U1 / U1.1 当前真相
- 家长总览页已收成 4 个一级块，首屏标题压短为“结论 + 一行解释”。
- 孩子首页已收成“今天先练这个”为核心的 4 个一级块，首屏标题进一步压短。
- 会员分层页已收成差异表达页，只保留当前档位摘要、三档差异主图、三张会员卡和主 CTA。
- 左侧导航已按“家长视角 / 学生视角 / 系统运营”重组。
- 手机端首屏已收紧，“其他孩子入口”不再完整摊开。
- 前台已清理 `student_id` 这类内部技术表达，不再直接对家长或学生暴露。

## Current Open Items
- 数据接口清单还未整理成仓库真相文档。
- 自动录入待审核队列还未进入实现。
- 人工审核确认流还未进入实现。
- 正式支付 / 订阅仍未做。
- 独立 worker / cron 仍未做。
- 外部真实诊断 provider 仍可能出现 `429 / Arrearage`，演示时需要按场景决定是否固定到 mock。

## Recommended Next Round
优先进入：
1. 数据接口清单
2. 自动录入待审核队列
3. 人工审核确认流

`A7` 不作为当前紧接的下一轮。