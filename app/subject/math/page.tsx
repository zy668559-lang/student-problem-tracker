export const dynamic = "force-dynamic";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getSubjectSnapshot } from "@/lib/db";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function MathSubjectPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getSubjectSnapshot("math", studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Math Module</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">数学模块</h1>
        <p className="mt-3 text-sm leading-7 text-slate">当前阶段：{snapshot.currentStage}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {snapshot.modules.map((module) => (
            <Badge key={module} tone="gold">{module}</Badge>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="最近卡点" subtitle="高频问题直接展示给家长。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyProblems.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="最近修复动作" subtitle="保持动作具体可执行。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyActions.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="重复错因" subtitle="持续回弹的问题优先解决。">
          <div className="flex flex-wrap gap-3">
            {snapshot.repeatedTags.map((item) => (
              <Badge key={item} tone="rose">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="最近变化记录" subtitle="记录已经稳住或仍不稳定的变化。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.recentChanges.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <Link href="/upload" className="inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
        上传新的数学资料
      </Link>
    </div>
  );
}
