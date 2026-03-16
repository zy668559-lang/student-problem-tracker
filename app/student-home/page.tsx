export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import { getStudentHomeSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function StudentHomePage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getStudentHomeSnapshot(studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8" data-testid="student-home-hero">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Student Home</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">{snapshot.studentName}，今天先顺着这条线往下练。</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">{snapshot.heroSummary}</p>
            <p className="mt-3 text-sm leading-6 text-slate">
              {snapshot.grade ? `${snapshot.grade}` : "年级待补"}{snapshot.school ? ` / ${snapshot.school}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="rose">主卡点</Badge>
            <Badge tone="gold">本周先做</Badge>
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="当前最主要卡点" subtitle="先看卡哪，不急着铺太多。">
          <p className="text-base leading-8 text-ink">{snapshot.currentBlockPoint}</p>
        </SectionCard>
        <SectionCard title="本周先做什么" subtitle="这周先做一条，别分心。">
          <p className="text-base leading-8 text-ink">{snapshot.thisWeekAction}</p>
        </SectionCard>
        <SectionCard title="最近一次复检结果" subtitle="有起色还是还没稳，这里只说一句。">
          <p className="text-base leading-8 text-ink">{snapshot.latestRecheckResult}</p>
        </SectionCard>
        <SectionCard title="本周变化一句话" subtitle="就一句，先看方向对不对。">
          <p className="text-base leading-8 text-ink">{snapshot.weeklyOneLiner}</p>
        </SectionCard>
        <SectionCard title="下轮优先级" subtitle="下一步先抓这一条。">
          <p className="text-base leading-8 text-ink">{snapshot.nextPriority}</p>
        </SectionCard>
        <SectionCard title="当前会员状态" subtitle="先把边界看明白，再决定要不要往下走。">
          <div className="space-y-3">
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
            <p className="text-base leading-8 text-ink">{snapshot.membership.label}</p>
            <p className="text-sm leading-7 text-slate">{snapshot.membership.detail}</p>
          </div>
        </SectionCard>
      </div>

      <section className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel sm:p-8" data-testid="student-home-practice-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Practice</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">今天先练这个入口</h2>
            <p className="mt-3 text-sm leading-7 text-slate">
              先别来回换线。你今天就照着这一步做：{snapshot.thisWeekAction}
            </p>
          </div>
          <Link
            href={snapshot.practiceHref}
            data-testid="student-home-practice-link"
            className="inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
          >
            今天先练这个
          </Link>
        </div>
      </section>

      <SectionCard title="顺手就能接下去的入口" subtitle="孩子自己能点，家长也看得懂。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/timeline" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">证据时间轴</p>
            <p className="mt-2 text-sm leading-6 text-slate">把问题、动作、变化一口气串起来看。</p>
          </Link>
          <Link href="/parent-overview" className="rounded-3xl border border-line bg-mist px-5 py-5">
            <p className="text-lg font-semibold text-ink">家长总览</p>
            <p className="mt-2 text-sm leading-6 text-slate">让家长一眼知道这周先盯谁、盯哪一步。</p>
          </Link>
          <Link href="/membership" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">会员分层</p>
            <p className="mt-2 text-sm leading-6 text-slate">先看边界，再决定要不要继续追。</p>
          </Link>
          <Link href={snapshot.continueTrackingHref} className="rounded-3xl border border-accent/20 bg-accent/10 px-5 py-5">
            <p className="text-lg font-semibold text-ink">继续追踪 4 周</p>
            <p className="mt-2 text-sm leading-6 text-slate">如果最怕回弹，就别只看这一次。</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
