# CURRENT_SPRINT

## Sprint
U1.1 轻精修轮

## 本轮唯一目标
在不新增业务逻辑、不改后端契约、不碰多学生隔离底座的前提下，把当前前台页面再收一刀，让页面从“已经像产品”变成“更适合家长看、更适合手机看、更像成熟产品”。

## 本轮只做什么
1. 压缩家长总览页首屏标题与副标题
2. 压缩孩子首页首屏标题与解释文案
3. 会员分层页去重、聚焦、减少重复说明
4. 清理前台内部字段、内部 key、技术字符串
5. 手机端收紧长度，尤其是“其他孩子入口”
6. 统一按钮主次、卡片留白、弱化次级入口

## 本轮明确不做什么
1. 不做正式支付/订阅
2. 不做 worker/cron
3. 不做新的业务逻辑
4. 不做底层表重构
5. 不做新的 API
6. 不改后端契约
7. 不动多学生隔离逻辑
8. 不重做时间轴、复检、会员状态壳层

## 允许修改的页面
1. 家长总览页
2. 孩子首页
3. 会员分层页
4. 左侧导航及其必要壳层

## 允许修改的文件
1. `app/parent-overview/page.tsx`
2. `app/student-home/page.tsx`
3. `app/membership/page.tsx`
4. `components/app-shell.tsx`
5. `components/section-card.tsx`（仅最小改）
6. `components/membership-tier-actions.tsx`（仅最小改）
7. `app/layout.tsx`（如确有必要，仅最小改）

## 明确禁止修改
1. `app/api/**`
2. `lib/db/membership.ts`
3. `lib/db/recheck.ts`
4. `lib/db/heartbeat.ts`
5. `lib/db/a4.ts`
6. 所有会改变后端契约的文件
7. 所有会改变多学生隔离底座的文件

## 本轮完成标准
1. 家长总览页首屏标题压短为“结论 + 一行解释”
2. 孩子首页首屏标题压短为“今天先做什么”
3. 前台不再出现内部 id、timeline key、技术字段名
4. 会员分层页只保留：
   - 当前档位摘要
   - 三档差异主图
   - 三张会员卡
   - 一个主 CTA
5. 手机端“其他孩子入口”默认折叠或横向滑动，不再完整摊开
6. 同一页面只保留一个最强主按钮
7. `npm run typecheck` 通过
8. `npm run build` 通过
9. `npm exec playwright test` 通过
10. 多学生切换不串线