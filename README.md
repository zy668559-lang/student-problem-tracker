# student-problem-tracker

学生问题诊断与变化追踪系统本地 MVP。
核心闭环：登录 -> 上传图片 -> 生成诊断 -> 生成周总结 -> 审核台确认 -> 家长后台查看变化。

## 技术栈

- Next.js 15 + App Router
- Tailwind CSS
- SQLite `better-sqlite3`
- 本地上传目录 `uploads/`
- AI service 支持 `mock` 和 Qwen 兼容接口
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

## 目录结构

```text
student-problem-tracker/
├─ app/
├─ components/
├─ data/
├─ lib/
│  ├─ db/
│  │  ├─ index.ts
│  │  └─ memory.ts
│  ├─ services/
│  │  ├─ ai/
│  │  │  └─ index.ts
│  │  └─ tone-chen.ts
│  ├─ mock-data.ts
│  ├─ types.ts
│  └─ utils.ts
├─ skills/
├─ tests/
│  ├─ e2e/
│  └─ fixtures/
├─ uploads/
├─ .env.example
├─ playwright.config.ts
└─ README.md
```

## 数据表

基础表：
- `users`
- `students`
- `uploads`
- `diagnoses`
- `repair_tasks`
- `weekly_reports`
- `change_logs`

阶段二新增：
- `memory_summaries`

## 本地运行

```bash
npm install
copy .env.example .env
npm run dev
```

访问：`http://localhost:3000/login`

演示账号：
- 邮箱：`parent@example.com`
- 密码：`demo123`

## 环境变量

```env
AI_PROVIDER=qwen
AI_API_KEY=
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL_PRIMARY=qwen3.5-plus
AI_MODEL_CHEAP=qwen3.5-flash
AI_MODEL_FALLBACK=gemini-2.5-flash
NEXT_PUBLIC_APP_NAME=Student Problem Tracker
```

说明：
- 本地无密钥时会自动回退到 mock。
- 真实诊断入口在 `lib/services/ai/index.ts`。
- 家长端文案会经过 `lib/services/tone-chen.ts` 的“陈老师口语化”改写层。
- 学生长期跟踪摘要保存在 `memory_summaries`，逻辑在 `lib/db/memory.ts`。

## Playwright 验收

运行：

```bash
npm run test:e2e
```

覆盖路径：
- `/login`
- `/dashboard`
- `/upload`
- `/diagnosis/[id]`
- `/weekly-report/[id]`
- `/review-queue`

测试产物：
- `playwright-report/`
- `test-results/results.json`
- `test-results/artifacts/`

## Skills 规则目录

- `skills/diagnosis-core.md`
- `skills/tone-chen-teacher.md`
- `skills/math-geometry.md`
- `skills/math-function.md`
- `skills/english-reading.md`
- `skills/english-cloze.md`
- `skills/english-writing.md`
- `skills/weekly-summary.md`
