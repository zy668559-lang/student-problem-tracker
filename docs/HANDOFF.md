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
- 当前轮次：`U1.1 轻精修轮`
- 当前状态：已完成并通过验证
- 最新验证：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）

## U1.1 本轮实际完成了什么
1. 家长总览页首屏标题进一步压短，保留“结论 + 一行解释”。
2. 孩子首页首屏标题进一步压短，继续把“今天先练这个”作为唯一核心动作。
3. 会员分层页删掉重复说明和分散入口，收成差异表达页。
4. 手机端信息继续收紧，“其他孩子入口”默认折叠后再横滑查看。
5. 左侧导航与按钮主次继续收口，次级入口被进一步弱化。
6. 前台清掉了 `student_id` 这类内部技术表达。

## 本轮额外做的验证解堵
- 修正了 `app/admin/assets/page.tsx` 中旧的损坏展示文案，恢复全仓 `build` 基线。
- 调整了 `playwright.config.ts` 的本地测试主机到 `127.0.0.1`，避免当前环境下 `localhost / ::1` 监听失败。
- 收紧了 `tests/e2e/admin.spec.ts` 和 `tests/e2e/membership-test-helpers.ts` 的会话与前置逻辑，让全量 e2e 在当前环境下稳定复现。

## 当前还没做什么
- 数据接口清单未整理
- 自动录入待审核队列未实现
- 人工审核确认流未实现
- 正式支付 / 订阅未实现
- 独立 worker / cron 未实现

## Next Step
下一轮优先进入：
1. 数据接口清单
2. 自动录入待审核队列
3. 人工审核确认流

当前不建议直接切入 `A7`。