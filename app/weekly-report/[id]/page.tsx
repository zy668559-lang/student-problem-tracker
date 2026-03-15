export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getWeeklyReportDetail } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function WeeklyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getWeeklyReportDetail(Number(id));

  if (!report) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Weekly Report</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{report.studentName} 的周总结</h1>
        <p className="mt-3 text-sm leading-7 text-slate">统计周期：{report.weekLabel} · 更新时间：{formatDate(report.createdAt)}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="家长版周总结" subtitle="一眼先看问题、动作、变化">
          <p className="text-base leading-8 text-ink">{report.payload.parent_weekly_summary ?? "这周先看问题有没有往下掉、动作有没有真的执行。"}</p>
        </SectionCard>
        <SectionCard title="学生版周总结" subtitle="学生只留一个清楚的执行方向">
          <p className="text-base leading-8 text-ink">{report.payload.student_weekly_summary ?? "这周先别贪多，把最关键的一步做顺。"}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="本周主要问题" subtitle="this_week_problem">
          <div className="flex flex-wrap gap-3">
            {report.payload.this_week_problem.map((item) => (
              <Badge key={item} tone="rose">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="本周修复动作" subtitle="this_week_actions">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.this_week_actions.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="本周稳住项" subtitle="improved_points">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.improved_points.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="本周未稳项" subtitle="unstable_points">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.unstable_points.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="重复错因标签" subtitle="repeated_error_tags">
          <div className="flex flex-wrap gap-3">
            {report.payload.repeated_error_tags.map((item) => (
              <Badge key={item} tone="gold">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="下周优先项" subtitle="next_week_plan">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.next_week_plan.map((item) => (
              <li key={item} className="rounded-2xl bg-ink px-4 py-3 text-white">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="复检状态" subtitle="recheck_status">
          <p className="text-base leading-8 text-ink">{report.payload.recheck_status ?? "这周先把当前动作跑一轮，我先不额外挂复检压力。"}</p>
        </SectionCard>
        <SectionCard title="下轮优先级" subtitle="next_priority">
          <p className="text-base leading-8 text-ink">{report.payload.next_priority ?? "下一轮先盯最新主卡点。"}</p>
        </SectionCard>
        <SectionCard title="是否建议继续追踪" subtitle="continue_tracking_label">
          <p className="text-base leading-8 text-ink">{report.payload.continue_tracking_label ?? (report.payload.continue_tracking_recommended ? "建议继续追踪" : "这周可以先轻盯")}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="继续追踪理由" subtitle="continue_tracking_reason">
          <p className="text-base leading-8 text-ink">{report.payload.continue_tracking_reason ?? "因为很多问题不是不会，是刚有进步但还没稳。"}</p>
        </SectionCard>
        <SectionCard title="今天先做哪一步" subtitle="student_today_action">
          <p className="text-base leading-8 text-ink">{report.payload.student_today_action ?? "今天先做一题最接近这次卡点的题。"}</p>
        </SectionCard>
        <SectionCard title="再练 1 个最小动作" subtitle="student_minimum_action">
          <p className="text-base leading-8 text-ink">{report.payload.student_minimum_action ?? "再练 1 个最小动作，把最容易掉链子的那一步单独做对。"}</p>
        </SectionCard>
      </div>

      <SectionCard title="做完怎么自检" subtitle="student_self_check">
        <p className="text-base leading-8 text-ink">{report.payload.student_self_check ?? "做完回头看：这次到底是真会了，还是只是碰巧做对。"}</p>
      </SectionCard>
    </div>
  );
}
