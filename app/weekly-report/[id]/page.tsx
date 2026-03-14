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
        <SectionCard title="已稳住项" subtitle="improved_points">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.improved_points.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="未稳住项" subtitle="unstable_points">
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
        <SectionCard title="下周计划" subtitle="next_week_plan">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {report.payload.next_week_plan.map((item) => (
              <li key={item} className="rounded-2xl bg-ink px-4 py-3 text-white">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

