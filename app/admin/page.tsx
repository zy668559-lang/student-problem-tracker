export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAdminControlCenterSnapshot } from "@/lib/db/a43";

function QueueSection({
  title,
  subtitle,
  items,
  testId
}: {
  title: string;
  subtitle: string;
  items: ReturnType<typeof getAdminControlCenterSnapshot>["followupItems"];
  testId: string;
}) {
  return (
    <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">{subtitle}</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <Link key={`${testId}-${item.studentId}-${item.href}`} href={item.href} className="block rounded-2xl border border-line px-4 py-4 transition hover:bg-mist">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{item.studentName} / {item.parentName}</p>
                <p className="mt-1 text-sm leading-6 text-slate">{item.summary}</p>
              </div>
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink">{item.badge}</span>
            </div>
          </Link>
        )) : <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm leading-6 text-slate">这块今天先没有要立刻处理的。</p>}
      </div>
    </section>
  );
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const params = await searchParams;
  const studentId = params.student ? Number(params.student) : null;
  const snapshot = getAdminControlCenterSnapshot(studentId && Number.isFinite(studentId) ? studentId : null);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">运营后台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这页就回答一个问题：今天先处理谁。先回访谁、先复检谁、先审核谁、谁最可能转成继续追踪，都按现成证据排出来。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[snapshot.todayFollowups, snapshot.todayRechecks, snapshot.todayReviews, snapshot.weeklyHighIntent, snapshot.weeklyBatchStatus, snapshot.todayModelCost].map((item) => (
          <div key={item.title} className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel" data-testid={`control-metric-${item.title}`}>
            <p className="text-sm text-slate">{item.title}</p>
            <p className="mt-3 text-4xl font-semibold text-ink">{item.count}</p>
            <p className="mt-3 text-sm leading-6 text-slate">{item.detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Quick Entry</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">快速入口</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {snapshot.quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-line px-4 py-4 transition hover:bg-mist">
              <p className="font-semibold text-ink">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <QueueSection title="今日待回访" subtitle="Followup" items={snapshot.followupItems} testId="control-followups" />
          <QueueSection title="今日待复检" subtitle="Recheck" items={snapshot.recheckItems} testId="control-rechecks" />
          <QueueSection title="今日待审核" subtitle="Review" items={snapshot.reviewItems} testId="control-reviews" />
          <QueueSection title="本周高意向家长" subtitle="Intent" items={snapshot.highIntentItems} testId="control-high-intent" />
        </div>

        <aside className="space-y-6" data-testid="control-selected-student">
          <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Student Focus</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">当前重点学生</h2>
            {snapshot.selectedStudent ? (
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate">
                <div>
                  <p className="font-semibold text-ink">{snapshot.selectedStudent.studentName} / {snapshot.selectedStudent.parentName}</p>
                  <p>{snapshot.selectedStudent.parentEmail}</p>
                  <p>student_id {snapshot.selectedStudent.studentId}</p>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {snapshot.studentChoices.map((item) => (
                    <Link
                      key={item.studentId}
                      href={`/admin?student=${item.studentId}`}
                      data-testid={`control-student-${item.studentId}`}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${snapshot.selectedStudentId === item.studentId ? "border-accent bg-accent/10 text-accent" : "border-line text-ink"}`}
                    >
                      {item.studentName} / {item.parentName}
                    </Link>
                  ))}
                </div>

                <div className="rounded-2xl bg-mist px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当前主要卡点</p>
                  <p className="mt-2 text-ink">{snapshot.selectedStudent.currentBlockPoint}</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">本周变化一句话</p>
                  <p className="mt-2 text-ink">{snapshot.selectedStudent.weeklyChangeSummary}</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">还没稳的一步</p>
                  <p className="mt-2 text-ink">{snapshot.selectedStudent.unstableStep}</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">下轮优先级</p>
                  <p className="mt-2 text-ink">{snapshot.selectedStudent.nextPriority}</p>
                </div>
              </div>
            ) : <p className="mt-4 text-sm leading-6 text-slate">暂时还没有学生摘要可以挂进来。</p>}
          </section>

          <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Recent Followup</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">最近跟进行动</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate">
              {snapshot.selectedStudent?.recentFollowupActions.map((item) => (
                <div key={item} className="rounded-2xl border border-line px-4 py-3">{item}</div>
              ))}
            </div>
          </section>

          <section className="rounded-panel border border-accent/20 bg-accent/10 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Suggested Script</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">建议跟进话术</h2>
            <p className="mt-4 text-sm leading-7 text-slate">{snapshot.selectedStudent?.suggestedFollowupScript ?? "这位家长当前还没有足够的跟进上下文。"}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
