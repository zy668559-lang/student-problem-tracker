# PROJECT_STATUS

## Last Updated
2026-03-17

## Branch Baseline
`feature/mvp-init`

## Current Summary
- 当前产品阶段：本地 MVP，已具备家长 / 学生 / 管理员三侧壳、真实会员状态、复检链路、变化记录、跟进漏斗、Heartbeat Lite。
- `U1` 视觉与信息收敛轮：已完成。
- `U1.1` 轻精修轮：已完成。
- `U1.2` 前台文案口语化真收口：已完成。
- 最新验证结果：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）
- 最新远端状态：本轮完成后应继续推送到 `github/gitee` 的 `feature/mvp-init`。

## U1 / U1.1 / U1.2 当前真相
- 家长总览页首屏保留 4 个一级块，文案已收成口语化表达。
- 孩子首页首屏继续围绕“今天先练这个 / 下次回看什么”。
- 会员页已收成差异表达页，能力项和 CTA 已换成家长可读的大白话。
- 前台目标页不再直接暴露 `证据时间轴`、`定向素材`、`老师纠偏`、`学生自述`、`timeline-*`、内部字段名。
- 桌面端和移动视口截图已导出到 `artifacts/u12-copy-closeout/`。

## Current Open Items
- 数据接口清单还未整理成仓库真相文档。
- 自动录入待审核队列还未进入实现。
- 人工审核确认流还未进入实现。
- 正式支付 / 订阅仍未做。
- 独立 worker / cron 仍未做。
- 如需同局域网手机访问，需要以 `0.0.0.0` 启动，而不是绑在 `127.0.0.1`。
- 外部真实诊断 provider 仍可能出现 `429 / Arrearage`，演示时需要按场景决定是否固定到 mock。

## Recommended Next Round
优先进入：
1. 数据接口清单
2. 自动录入待审核队列
3. 人工审核确认流
