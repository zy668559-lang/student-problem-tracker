# student-problem-tracker

学生问题诊断与变化追踪系统本地 MVP。

核心闭环：家长登录后台 -> 上传错题/作业/试卷图片 -> 生成结构化诊断 JSON -> 生成修复动作 -> 汇总周总结 -> 审核台通过/修改/驳回。

## 技术栈

- Next.js 15 + App Router
- Tailwind CSS
- SQLite（better-sqlite3）
- 本地文件上传目录：`uploads/`
- AI service 先走 mock，真实模型接口已预留
- Playwright 端到端自动验收

## 已实现页面

- `/login`
- `/dashboard`
- `/upload`
- `/subject/math`
- `/subject/english`
- `/diagnosis/[id]`
- `/weekly-report/[id]`
- `/review-queue`

## 项目结构

```text
student-problem-tracker/
├─ app/
│  ├─ api/
│  │  ├─ auth/login/route.ts
│  │  ├─ logout/route.ts
│  │  ├─ review/[id]/route.ts
│  │  └─ uploads/route.ts
│  ├─ dashboard/page.tsx
│  ├─ diagnosis/[id]/page.tsx
│  ├─ login/page.tsx
│  ├─ review-queue/page.tsx
│  ├─ subject/english/page.tsx
│  ├─ subject/math/page.tsx
│  ├─ upload/page.tsx
│  ├─ weekly-report/[id]/page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ not-found.tsx
│  └─ page.tsx
├─ components/
│  ├─ ui/badge.tsx
│  ├─ app-shell.tsx
│  ├─ login-form.tsx
│  ├─ metric-card.tsx
│  ├─ review-queue-item.tsx
│  ├─ section-card.tsx
│  └─ upload-form.tsx
├─ lib/
│  ├─ db/index.ts
│  ├─ services/ai/index.ts
│  ├─ mock-data.ts
│  ├─ types.ts
│  └─ utils.ts
├─ tests/
│  ├─ e2e/closure.spec.ts
│  └─ fixtures/sample-upload.png
├─ uploads/
├─ .env.example
├─ middleware.ts
├─ next.config.mjs
├─ package.json
├─ playwright.config.ts
├─ postcss.config.mjs
├─ README.md
├─ tailwind.config.ts
└─ tsconfig.json
```

## 数据表

已建立最小可用表结构：

- `users`
- `students`
- `uploads`
- `diagnoses`
- `repair_tasks`
- `weekly_reports`
- `change_logs`

数据库文件会在首次运行时自动生成到 `data/student-problem-tracker.db`。

## 诊断 JSON 结构

```json
{
  "current_stage": "函数图像识别不稳，已能复盘但独立迁移不足",
  "subject": "math",
  "module": "函数",
  "problem_tags": ["审题遗漏条件"],
  "repair_actions": ["每天 1 组函数图像判读卡片"],
  "parent_summary": "家长摘要",
  "confidence": 0.84,
  "review_status": "pending"
}
```

## 周总结 JSON 结构

```json
{
  "this_week_problem": ["函数图像与条件联动不稳"],
  "this_week_actions": ["函数模块每天固定判图练习"],
  "improved_points": ["阅读题干关键词开始会圈画"],
  "unstable_points": ["数学漏条件回弹"],
  "repeated_error_tags": ["审题遗漏条件"],
  "next_week_plan": ["数学聚焦函数"]
}
```

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板并手动填写

```bash
copy .env.example .env
```

3. 启动开发环境

```bash
npm run dev
```

4. 打开浏览器

```text
http://localhost:3000/login
```

演示账号：

- 邮箱：`parent@example.com`
- 密码：`demo123`

## 本地验证命令

```bash
npm run typecheck
npm run build
npm run test:e2e
```

## Playwright 验收覆盖

- `/login`
- `/dashboard`
- `/upload`
- `/diagnosis/[id]`
- `/weekly-report/[id]`
- `/review-queue`

自动验收闭环：

1. 登录
2. 上传测试图片
3. 自动生成诊断页面并提取 `diagnosisId`
4. 自动进入周总结页面并提取 `weeklyReportId`
5. 审核台执行修改/通过/驳回
6. 自动保存截图、trace、JSON 报告和浏览器日志

测试产物目录：

- `playwright-report/`
- `test-results/results.json`
- `test-results/artifacts/`

## 已打通流程

1. 登录后进入家长后台。
2. 上传数学或英语图片资料并填写模块、分数备注、学生自述。
3. API 将文件保存到 `uploads/`，同时写入 `uploads` 表。
4. AI service 生成结构化诊断 JSON，写入 `diagnoses` 表。
5. 自动拆分修复动作写入 `repair_tasks`。
6. 自动生成或更新 `weekly_reports`。
7. 审核台支持通过、修改、驳回，并刷新周总结。

## 真实 AI 接口接入位置

主入口：`lib/services/ai/index.ts`

当前逻辑：

- `analyzeUpload()`：根据 `AI_PROVIDER` 走 mock 或 real 分支
- `runRealDiagnosis()`：真实模型调用预留位置
- `generateWeeklyReport()`：周总结聚合逻辑

建议真实接入步骤：

1. 在 `runRealDiagnosis()` 中替换为真实模型请求。
2. 保持输出字段严格对齐 `DiagnosisPayload`。
3. 如需周总结走模型生成，可在 `generateWeeklyReport()` 中增加模型调用，再兜底回退到本地聚合。

## 需要手动填写的 .env 字段

```env
AI_PROVIDER=mock
AI_API_KEY=
AI_BASE_URL=
NEXT_PUBLIC_APP_NAME=Student Problem Tracker
```

说明：

- `AI_PROVIDER=mock` 表示继续使用本地 mock 结果。
- 切到真实模型时可改为 `AI_PROVIDER=real`。
- `AI_API_KEY` 和 `AI_BASE_URL` 必须由你手动填写，不会写死进代码。

## Git 初始化与双远程配置

当前本地分支：`feature/mvp-init`

如果你已经有远程仓库地址，执行：

```bash
git remote add github <YOUR_GITHUB_REPO_URL>
git remote add gitee <YOUR_GITEE_REPO_URL>
git remote -v
```

审核通过后再执行：

```bash
git checkout main
git merge --no-ff feature/mvp-init
git push github main
git push gitee main
```

如果远程 `main` 受保护，改为：

```bash
git push github feature/mvp-init
git push gitee feature/mvp-init
```

然后在远程仓库发起合并流程，不要强推。

## 本次生成结果与测试结果

已完成：

- 项目初始化与 git 分支切换
- 页面骨架与后台布局
- mock 数据与 SQLite 本地数据库
- 上传保存流程
- 诊断结果展示流程
- 周总结展示流程
- 审核台流程
- 审核后 `repair_tasks` / `weekly_reports` / `change_logs` 联动
- AI service 预留接口
- Playwright 端到端自动验收
- README 与运行说明

本地测试结果：

- `npm run typecheck` 通过
- `npm run build` 通过
- `npm run test:e2e` 通过
- Playwright 覆盖指定 6 条页面路径
- 自动保存截图、trace、JSON 报告到 `test-results/` 与 `playwright-report/`
- 自动验证上传后会生成新的 `diagnosisId` 与 `weeklyReportId`
- 自动验证审核修改/通过/驳回均会落库