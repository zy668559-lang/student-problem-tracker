# PROJECT_STATUS

## Last Updated
2026-03-18

## Branch Baseline
`feature/mvp-init`

## Current Summary
- 当前产品阶段：本地 MVP，已具备家长 / 学生 / 管理员三侧壳、真实会员状态、复检链路、变化记录、跟进漏斗、Heartbeat Lite。
- `U1` 视觉与信息收敛轮：已完成。
- `U1.1` 轻精修轮：已完成。
- `U1.2` 前台文案口语化真收口：已完成。
- `U1.2` 验收补改：已完成。
- 最新验证结果：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）
- 最新远端状态：本轮完成后应继续推送到 `github/gitee` 的 `feature/mvp-init`。

## 当前真相
- 家长侧导航中的会员入口已明确写成 `会员分层`。
- 前台旧入口里残留的 `证据时间轴` 已改成 `变化记录`。
- 家长页、孩子页、会员页的口语化收口仍保持成立。
- 手机端并不是只有问题看板这个路由能打开；问题主要在于移动端默认入口暴露较少，以及真机访问需要 `0.0.0.0` 启动。

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
