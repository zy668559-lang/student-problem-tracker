export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import { StudentScopedLink } from "@/components/student-scoped-link";
import { getParentOverviewSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function ParentOverviewPage() {
  const session = await getServerSession();

  if (!session?.userId) {
    notFound();
  }

  const studentId = getActiveStudentId(session);
  const snapshot = getParentOverviewSnapshot(session.userId, studentId);
  const active = snapshot.activeStudent;

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8" data-testid="parent-overview-active">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Parent Overview</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">家长先别来回翻，这周先盯 {active.studentName} 这一条。</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">{active.currentStatus}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="rose">当前 student_id：{active.studentId}</Badge>
            <Badge tone={active.membership.tone}>{active.membership.tierLabel}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="当前状态" subtitle="这周最该盯的结论。">
          <p className="text-base leading-8 text-ink">{active.currentStatus}</p>
        </SectionCard>
        <SectionCard title="本周变化摘要" subtitle="先看方向有没有往前。">
          <p className="text-base leading-8 text-ink">{active.weeklyOneLiner}</p>
        </SectionCard>
        <SectionCard title="还没稳的一步" subtitle="现在最怕这里回弹。">
          <p className="text-base leading-8 text-ink">{active.unstableStep}</p>
        </SectionCard>
        <SectionCard title="当前会员状态" subtitle="先看边界，再决定要不要升级。">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Badge tone={active.membership.tone}>{active.membership.tierLabel}</Badge>
              <Badge tone="gold">{active.membership.statusLabel}</Badge>
            </div>
            <p className="text-sm leading-7 text-slate">{active.membership.label}</p>
          </div>
        </SectionCard>
      </div>

      <section className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Current Focus</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">{active.studentName} 这周先别换线。</h2>
            <p className="mt-3 text-sm leading-7 text-slate">
              这位孩子当前最主要卡点是：{active.currentBlockPoint} 下轮优先级先按这条：{active.nextPriority}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StudentScopedLink
              studentId={active.studentId}
              href="/timeline"
              testId="parent-overview-active-timeline"
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
            >
              最近证据时间轴
            </StudentScopedLink>
            <StudentScopedLink
              studentId={active.studentId}
              href={active.continueTrackingHref}
              testId="parent-overview-active-continue"
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
            >
              {active.membership.tier === "trial" ? "申请开通自助会员" : active.membership.tier === "self_service" ? "咨询升级陪跑" : "继续按陪跑节奏走"}
            </StudentScopedLink>
            <StudentScopedLink
              studentId={active.studentId}
              href="/membership"
              testId="parent-overview-active-membership"
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
            >
              看会员边界
            </StudentScopedLink>
          </div>
        </div>
      </section>

      <SectionCard title="绑定的孩子列表" subtitle="每个孩子都分开看；切谁，顶部摘要就跟谁走。">
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.students.map((student) => (
            <article
              key={student.studentId}
              data-testid={`parent-overview-student-${student.studentId}`}
              className={`rounded-3xl border px-5 py-5 ${student.isActive ? "border-accent/30 bg-accent/10" : "border-line bg-white"}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold text-ink">{student.studentName}</p>
                    {student.isActive ? <Badge tone="accent">当前查看中</Badge> : null}
                    <Badge tone={student.membership.tone}>{student.membership.tierLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate">{student.currentStatus}</p>
                </div>
                <StudentScopedLink
                  studentId={student.studentId}
                  href="/student-home"
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink"
                >
                  看孩子首页
                </StudentScopedLink>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">本周变化摘要</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{student.weeklyOneLiner}</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">还没稳的一步</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{student.unstableStep}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <StudentScopedLink
                  studentId={student.studentId}
                  href="/timeline"
                  testId={`parent-overview-timeline-${student.studentId}`}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink"
                >
                  最近证据时间轴
                </StudentScopedLink>
                <StudentScopedLink
                  studentId={student.studentId}
                  href={student.continueTrackingHref}
                  testId={`parent-overview-continue-${student.studentId}`}
                  className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
                >
                  {student.membership.tier === "trial" ? "申请开通自助会员" : student.membership.tier === "self_service" ? "咨询升级陪跑" : "继续按陪跑节奏走"}
                </StudentScopedLink>
                <StudentScopedLink
                  studentId={student.studentId}
                  href="/membership"
                  testId={`parent-overview-membership-${student.studentId}`}
                  className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-semibold text-ink"
                >
                  当前会员状态与升级入口
                </StudentScopedLink>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
