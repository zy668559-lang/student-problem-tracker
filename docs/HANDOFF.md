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
- 当前状态：补验收修正已完成并通过验证
- 最新验证：
  - `npm run typecheck`：通过
  - `npm run build`：通过
  - `npm exec playwright test`：通过（`30 passed`）

## 这次补验收实际完成了什么
1. 把前台旧入口里残留的 `证据时间轴` 改成了 `变化记录`。
2. 把家长视角里的 `三种方式差在哪` 改成了 `会员分层`。
3. 重新确认了手机端并不是只有问题看板路由能开；当前主要问题是移动端默认不常驻显示侧边导航，且真机访问必须用 `0.0.0.0` 启动。

## 手机端说明
- 路由本身仍可直接访问，例如：`/parent-overview`、`/student-home`、`/membership`。
- 如果真机上只能看到问题看板，优先排查两件事：
  1. 服务是否绑在 `127.0.0.1`
  2. 是否只是因为移动端没有常驻侧边导航入口
- 真机访问命令：
  - `npm run start -- --hostname 0.0.0.0 --port 3000`
  - `http://192.168.0.102:3000/login`

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
