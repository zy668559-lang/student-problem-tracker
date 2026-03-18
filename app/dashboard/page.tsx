export const dynamic = "force-dynamic";

import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSnapshot } from "@/lib/db";
import { getMemorySummary } from "@/lib/db/memory";
import { getPriorityRecheckTask } from "@/lib/db/p25";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getDashboardSnapshot(studentId);
  const memory = getMemorySummary(studentId);
  const priorityRecheck = getPriorityRecheckTask(studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">{snapshot.studentName} 的本周问题看板</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">当前阶段：{snapshot.currentStage}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="accent">问题</Badge>
            <Badge tone="gold">动作</Badge>
            <Badge tone="ink">变化</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="本周上传次数" value={snapshot.weeklyUploadCount} detail="家长或学生这周已经传过多少次材料。" />
        <MetricCard label="主要问题数" value={snapshot.weeklyProblems.length || 0} detail="从最近诊断里提出来的高频卡点。" />
        <MetricCard label="修复动作数" value={snapshot.weeklyActions.length || 0} detail="这周系统已经给出的动作数量。" />
        <MetricCard label="变化记录" value={snapshot.weeklyChanges.length || 0} detail="最近已经记下来的改善或回弹。" />
      </div>

      {priorityRecheck ? (
        <section className="rounded-panel border border-accent/20 bg-accent/10 p-5 shadow-panel">
          <p className="text-sm font-semibold text-ink">当前最该先回头看的复检任务</p>
          <p className="mt-2 text-sm leading-6 text-slate">先盯 {priorityRecheck.tag}。这条现在是“{priorityRecheck.status === "stabilized" ? "已稳住" : priorityRecheck.status === "passed_once" ? "有进步，但还没稳" : "本周必须再检"}”，顺着这条线继续看最省力。</p>
          <Link href={`/recheck/${priorityRecheck.id}`} className="mt-4 inline-flex rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white">去做这条复检</Link>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <SectionCard title="本周主要问题" subtitle="优先让家长先看到孩子卡在哪">
          <div className="flex flex-wrap gap-3">
            {snapshot.weeklyProblems.map((item) => (
              <Badge key={item} tone="rose">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="本周修复动作" subtitle="动作保持少而明确，避免执行过载">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyActions.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="本周变化情况" subtitle="最近是不是真的发生变化了">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyChanges.length > 0 ? snapshot.weeklyChanges.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            )) : <li className="text-slate">等下一次上传后，我再帮你把变化记下来。</li>}
          </ul>
        </SectionCard>
        <SectionCard title="下周重点" subtitle="只保留最值得盯住的重点">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.nextWeekFocus.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="学生记忆摘要" subtitle="memory summary">
          <div className="space-y-4 text-sm leading-6 text-slate">
            <div>
              <p className="font-semibold text-ink">稳住标签</p>
              <ul className="mt-2 space-y-2">
                {memory.stable_tags.map((item) => (
                  <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">重复错因</p>
              <ul className="mt-2 space-y-2">
                {memory.repeated_error_tags.map((item) => (
                  <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">复检状态</p>
              <div className="mt-2 rounded-2xl border border-line px-4 py-3 text-ink">{memory.recheck_status_summary}</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="最近三周焦点" subtitle="last_3_weeks_focus / next_priority">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {memory.last_3_weeks_focus.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-ink px-4 py-4 text-sm font-medium leading-6 text-white">{memory.next_priority}</div>
          <div className="mt-4 rounded-2xl border border-line px-4 py-4 text-sm leading-6 text-ink">{memory.next_action_type}</div>
        </SectionCard>
      </div>

      <SectionCard title="快速入口" subtitle="直接进入上传、诊断、周总结和复检页。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Link href="/upload" className="rounded-3xl bg-ink px-5 py-5 text-white">
            <p className="text-lg font-semibold">继续上传</p>
            <p className="mt-2 text-sm text-white/70">新增错题、作业或试卷图片</p>
          </Link>
          <Link href={priorityRecheck ? `/recheck/${priorityRecheck.id}` : "/upload"} className="rounded-3xl border border-accent/20 bg-accent/10 px-5 py-5">
            <p className="text-lg font-semibold text-ink">去做复检</p>
            <p className="mt-2 text-sm text-slate">先把还没稳住的那一条接着看</p>
          </Link>
          <Link href={snapshot.latestDiagnosisId ? `/diagnosis/${snapshot.latestDiagnosisId}` : "/upload"} className="rounded-3xl border border-line bg-mist px-5 py-5">
            <p className="text-lg font-semibold text-ink">查看最新诊断</p>
            <p className="mt-2 text-sm text-slate">看看结构化诊断和下一步动作</p>
          </Link>
          <Link href={snapshot.latestWeeklyReportId ? `/weekly-report/${snapshot.latestWeeklyReportId}` : "/review-queue"} className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">查看周总结</p>
            <p className="mt-2 text-sm text-slate">聚合一周变化、未稳项和下周计划</p>
          </Link>
          <Link href="/timeline" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">变化记录</p>
            <p className="mt-2 text-sm text-slate">把上周到这周的问题、回看、每周小结和变化顺着看</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

