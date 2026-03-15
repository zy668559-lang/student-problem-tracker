export const dynamic = "force-dynamic";

import { RecheckTasksManager } from "@/components/admin/recheck-tasks-manager";
import { SectionCard } from "@/components/section-card";
import { ensureP25Schema, listAdminRecheckTasksDetailed } from "@/lib/db/p25";

export default function AdminRecheckTasksPage() {
  ensureP25Schema();
  const tasks = listAdminRecheckTasksDetailed();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Recheck</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">复检任务台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这里不只看系统怎么判，还能让老师手动纠偏：标记稳没稳、改优先级、写原因，并且自动回写到记忆、变化和周报。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard title="任务总数" subtitle="all">
          <p className="text-3xl font-semibold text-ink">{tasks.length}</p>
        </SectionCard>
        <SectionCard title="必须再检" subtitle="recheck_due">
          <p className="text-3xl font-semibold text-ink">{tasks.filter((item) => item.status === "recheck_due").length}</p>
        </SectionCard>
        <SectionCard title="有进步未稳" subtitle="passed_once / improving">
          <p className="text-3xl font-semibold text-ink">{tasks.filter((item) => item.status === "passed_once" || item.status === "improving").length}</p>
        </SectionCard>
        <SectionCard title="已稳住" subtitle="stabilized">
          <p className="text-3xl font-semibold text-ink">{tasks.filter((item) => item.stabilized).length}</p>
        </SectionCard>
      </div>

      <SectionCard title="当前复检任务" subtitle="人工纠偏会直接写回 student_memory / change_logs / weekly_reports">
        <RecheckTasksManager items={tasks} />
      </SectionCard>
    </div>
  );
}
