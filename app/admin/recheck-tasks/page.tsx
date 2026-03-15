export const dynamic = "force-dynamic";

import { SectionCard } from "@/components/section-card";

export default function AdminRecheckTasksPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Recheck</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">复检任务占位</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这轮先把入口和 student_id 串联关系埋好，不在这里提前做复检业务。下一轮会直接接这里，不再返工表结构。</p>
      </section>

      <SectionCard title="当前状态" subtitle="只占位，不跑业务">
        <ul className="space-y-3 text-sm leading-7 text-slate">
          <li className="rounded-2xl border border-line px-4 py-3">已预留 `recheck_tasks` 表，后续可按学生独立排任务。</li>
          <li className="rounded-2xl border border-line px-4 py-3">结果页已预留“复检状态 / 下轮优先级”占位字段。</li>
          <li className="rounded-2xl border border-line px-4 py-3">当前不做复检回写、不做支付、不做下轮业务动作。</li>
        </ul>
      </SectionCard>
    </div>
  );
}
