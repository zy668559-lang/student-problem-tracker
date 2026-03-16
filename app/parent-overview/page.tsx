export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import { StudentScopedLink } from "@/components/student-scoped-link";
import { getParentOverviewSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

const toneClasses = {
  red: {
    chip: "bg-rose/12 text-rose border-rose/20",
    fill: "bg-rose",
    text: "当前最卡"
  },
  orange: {
    chip: "bg-[#f59e0b]/12 text-[#b45309] border-[#f59e0b]/25",
    fill: "bg-[#f59e0b]",
    text: "还没稳"
  },
  blue: {
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    fill: "bg-sky-500",
    text: "本周推进中"
  },
  green: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    fill: "bg-emerald-500",
    text: "已稳"
  },
  gray: {
    chip: "bg-mist text-slate border-line",
    fill: "bg-slate/35",
    text: "弱信息"
  }
} as const;

const trendHeight = {
  1: "h-8",
  2: "h-14",
  3: "h-20",
  4: "h-24"
} as const;

function renderStateRail(tone: keyof typeof toneClasses) {
  const activeIndex = {
    red: 0,
    orange: 1,
    blue: 2,
    green: 3,
    gray: -1
  }[tone];

  return (
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={`h-2 rounded-full ${index === activeIndex ? toneClasses[tone].fill : "bg-mist"}`}
        />
      ))}
    </div>
  );
}

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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Parent Overview</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">这周先盯 {active.studentName} 的“{active.unstableStep}”。</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">{active.currentStatus}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="rose">当前学生 #{active.studentId}</Badge>
            <Badge tone={active.membership.tone}>{active.membership.tierLabel}</Badge>
            <Badge tone="gold">{active.membership.statusLabel}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard title="当前最卡" subtitle="先看最该盯的那一处。">
          <p className="text-lg font-semibold text-ink">{active.currentBlockPoint}</p>
          <p className="mt-3 text-sm leading-6 text-slate">一上来只抓这一条，不分散。</p>
        </SectionCard>
        <SectionCard title="这周先做" subtitle="动作只留一条主线。">
          <p className="text-lg font-semibold text-ink">{active.thisWeekAction}</p>
          <p className="mt-3 text-sm leading-6 text-slate">先做顺这一条，再谈加量。</p>
        </SectionCard>
        <SectionCard title="还没稳的一步" subtitle="最容易回弹的地方。">
          <p className="text-lg font-semibold text-ink">{active.unstableStep}</p>
          <p className="mt-3 text-sm leading-6 text-slate">这一步看着会了，也最容易掉回去。</p>
        </SectionCard>
        <SectionCard title="继续追踪理由" subtitle="先结论，再决定要不要继续。">
          <p className="text-lg font-semibold text-ink">{active.continueTrackingReason}</p>
          <p className="mt-3 text-sm leading-6 text-slate">不是没变化，是还没稳到能放手。</p>
        </SectionCard>
      </div>

      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Main Chart</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">这条主线现在看到哪</h2>
            <p className="mt-2 text-sm leading-6 text-slate">只用 4 档状态横条，不假装精确打分。</p>
          </div>
          <p className="text-sm leading-6 text-slate">{active.weeklyOneLiner}</p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {active.parentMainChart.map((item) => {
            const tone = toneClasses[item.tone];
            return (
              <article key={item.label} className="rounded-3xl border border-line bg-mist/45 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-ink">{item.label}</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.chip}`}>{tone.text}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink">{item.detail}</p>
                <div className="mt-4">{renderStateRail(item.tone)}</div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="最近 4 周变化" subtitle="只看有没有往前推，和稳住了几项。">
          <div className="grid gap-4 sm:grid-cols-4">
            {active.weeklyTrend.map((item) => (
              <article key={item.label} className="rounded-3xl border border-line bg-white px-4 py-4">
                <div className="flex h-28 items-end justify-center rounded-2xl bg-mist/70 px-3 pb-3">
                  <div className={`w-12 rounded-t-2xl ${trendHeight[item.value as keyof typeof trendHeight]} ${toneClasses[item.tone].fill}`} />
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate">{item.note}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <section className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Next Step</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">先把价值看清，再决定怎么继续。</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-white/70 bg-white/90 px-5 py-4">
              <p className="text-sm font-semibold text-ink">本周变化一句话</p>
              <p className="mt-2 text-sm leading-7 text-slate">{active.weeklyOneLiner}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/90 px-5 py-4">
              <p className="text-sm font-semibold text-ink">当前会员边界</p>
              <p className="mt-2 text-sm leading-7 text-slate">{active.membership.label}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <StudentScopedLink
              studentId={active.studentId}
              href="/timeline"
              testId="parent-overview-active-timeline"
              className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
            >
              看证据时间轴
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
              看会员差异
            </StudentScopedLink>
          </div>
        </section>
      </div>

      <SectionCard title="其他孩子入口" subtitle={`当前账号下共 ${snapshot.totalStudents} 个孩子，切谁就看谁，不会串线。`}>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">这周先做</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{student.thisWeekAction}</p>
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
                  看时间轴
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
                  看会员差异
                </StudentScopedLink>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
