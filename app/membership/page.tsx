export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MembershipTierActions } from "@/components/membership-tier-actions";
import { SectionCard } from "@/components/section-card";
import { getMembershipPageSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function MembershipPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getMembershipPageSnapshot(studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8" data-testid="membership-status">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Membership</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">{snapshot.studentName} 这一条，现在适合走到哪一层，我先给你讲明白。</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
              当前主卡点是：{snapshot.currentBlockPoint}。这周最怕回弹的一步是：{snapshot.unstableStep}
            </p>
          </div>
          <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当前会员状态</p>
            <p className="mt-2 text-base leading-8 text-ink">{snapshot.membership.label}</p>
          </div>
          <div className="rounded-2xl border border-line px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">本周变化一句话</p>
            <p className="mt-2 text-base leading-8 text-ink">{snapshot.weeklyOneLiner}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {snapshot.tiers.map((tier) => (
          <SectionCard key={tier.slug} title={tier.title} subtitle={tier.highlight}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-ink">能得到什么</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate">
                  {tier.gets.map((item) => (
                    <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm font-semibold text-ink">适合什么人</p>
                <p className="mt-2 text-sm leading-7 text-slate">{tier.fits}</p>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm font-semibold text-ink">和上一层差在哪</p>
                <p className="mt-2 text-sm leading-7 text-slate">{tier.difference}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <MembershipTierActions
        diagnosisId={snapshot.latestDiagnosisId}
        continueTrackingHref={snapshot.continueTrackingHref}
        trackingStatus={snapshot.membership.trackingStatus}
      />

      <SectionCard title="顺着往下走的入口" subtitle="想继续看证据，还是先回家长总览，这里都能接上。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/student-home" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">回孩子首页</p>
            <p className="mt-2 text-sm leading-6 text-slate">孩子自己打开，也能知道今天先练什么。</p>
          </Link>
          <Link href="/parent-overview" className="rounded-3xl border border-line bg-mist px-5 py-5">
            <p className="text-lg font-semibold text-ink">回家长总览</p>
            <p className="mt-2 text-sm leading-6 text-slate">先看这周最该盯谁、盯哪一步。</p>
          </Link>
          <Link href="/timeline" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">看证据时间轴</p>
            <p className="mt-2 text-sm leading-6 text-slate">别靠感觉，看证据线最稳。</p>
          </Link>
          <Link href={snapshot.continueTrackingHref} className="rounded-3xl border border-accent/20 bg-accent/10 px-5 py-5">
            <p className="text-lg font-semibold text-ink">继续追踪 4 周</p>
            <p className="mt-2 text-sm leading-6 text-slate">如果最怕回弹，就顺着这条线继续接。</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
