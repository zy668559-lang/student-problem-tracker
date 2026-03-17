# HANDOFF

## Read First
开始下一轮前，按这个顺序读取：
1. `docs/PROJECT_STATUS.md`
2. `docs/CURRENT_SPRINT.md`
3. `docs/HANDOFF.md`
4. `docs/OPENCLAW_ADAPTATION.md`
5. `docs/DECISIONS.md`
6. `docs/U1_VISUAL_INFO_REDUCTION.md`
7. `docs/U11_FINE_TUNING.md`

## Current Repository State
- 分支：`feature/mvp-init`
- 当前轮次：`U1.2 前台文案口语化真收口`
- 当前状态：已完成并通过验证
- 最新验证：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）

## U1.2 本轮实际完成了什么
1. 家长总览页首屏文案统一收成大白话，第四张卡改成“为什么还要继续跟”。
2. 孩子首页首屏文案统一收成“今天先做什么 / 下次回看什么”的表达，不再冒内部词。
3. 会员页三档差异文案、能力项名称、CTA 文案都改成口语化表达。
4. 前台目标页和文案来源清掉了 `证据时间轴 / 定向素材 / 老师纠偏 / 学生自述 / timeline-* / 内部字段名` 这类前台不该出现的词。
5. 桌面端与移动视口重新验页，并导出最新截图。

## 页面验收产物
- 截图目录：`artifacts/u12-copy-closeout/`
- 已导出：
  - `parent-overview-desktop.png`
  - `student-home-desktop.png`
  - `membership-desktop.png`
  - `parent-overview-mobile.png`

## 真机访问说明
- 代码层面的移动端版式已通过 `390x844` 视口验收。
- 如需同局域网手机直接访问，请用：
  - `npm run start -- --hostname 0.0.0.0 --port 3000`
  - 然后打开：`http://192.168.0.102:3000/login`
- 当前仓库没有额外真机适配代码缺口，关键点是启动主机不能绑在 `127.0.0.1`。

## 当前还没做什么
- 数据接口清单未整理
- 自动录入待审核队列未实现
- 人工审核确认流未实现
- 正式支付 / 订阅未实现
- 独立 worker / cron 未实现

## 环境提醒
- 外部真实诊断 provider 仍可能返回 `429 / Arrearage`。
- 当前系统仍会回退到 mock diagnosis，所以不会把主链路打死；如果是页面演示，建议优先使用稳定 provider 或直接固定到 mock。

## Next Step
下一轮优先进入：
1. 数据接口清单
2. 自动录入待审核队列
3. 人工审核确认流
