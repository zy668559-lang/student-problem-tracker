export const dynamic = "force-dynamic";

import { SectionCard } from "@/components/section-card";
import { listAllRecheckTasks } from "@/lib/db/recheck";
import { ensureProductSchema } from "@/lib/db/product";

function statusLabel(value: string) {
  switch (value) {
    case "recheck_due":
      return "本周必须再检";
    case "passed_once":
      return "有进步，但还没稳";
    case "stabilized":
      return "已稳住";
    case "improving":
      return "有进步，继续盯";
    case "dismissed":
      return "已撤销";
    default:
      return "已挂复检";
  }
}

export default function AdminRecheckTasksPage() {
  ensureProductSchema();
  const tasks = listAllRecheckTasks();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Recheck</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">复检任务台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这页只看三件事：哪类题要再检、现在稳没稳、下轮该先盯谁。</p>
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

      <SectionCard title="当前复检任务" subtitle="按最近更新排序">
        <div className="space-y-4">
          {tasks.length > 0 ? tasks.map((task) => (
            <article key={task.id} className="rounded-3xl border border-line bg-white p-5" data-testid={`recheck-task-${task.id}`} data-diagnosis-id={task.diagnosisId ?? undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{task.tag || task.module}</p>
                  <p className="mt-1 text-sm text-slate">{task.subject} / {task.module} / {statusLabel(task.status)} / 诊断 #{task.diagnosisId ?? "-"}</p>
                </div>
                <div className="text-right text-sm text-slate">
                  <p>7 天重复：{task.repeatCount7d}</p>
                  <p>30 天重复：{task.repeatCount30d}</p>
                  <p>稳住分：{task.stabilizedScore}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate lg:grid-cols-3">
                <div className="rounded-2xl bg-mist px-4 py-3 text-ink">{task.triggerReason}</div>
                <div className="rounded-2xl border border-line px-4 py-3">{task.nextPriority}</div>
                <div className="rounded-2xl border border-line px-4 py-3">{task.continueTrackingReason}</div>
              </div>
            </article>
          )) : <p className="text-sm leading-7 text-slate">暂时还没有复检任务，先等下一条诊断生成。</p>}
        </div>
      </SectionCard>
    </div>
  );
}
