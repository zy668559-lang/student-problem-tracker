export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MembershipTierActions } from "@/components/membership-tier-actions";
import { SectionCard } from "@/components/section-card";
import { getMembershipPageSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

const capabilityLabel = {
  off: { text: "未开", className: "bg-mist text-slate border-line" },
  limited: { text: "轻", className: "bg-[#f59e0b]/12 text-[#b45309] border-[#f59e0b]/25" },
  on: { text: "有", className: "bg-sky-100 text-sky-700 border-sky-200" },
  high: { text: "强", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
} as const;

export default async function MembershipPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getMembershipPageSnapshot(studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8" data-testid="membership-status">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Membership</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">先看边界，再决定要不要升级。</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
              当前主卡点是“{snapshot.currentBlockPoint}”。这周最怕回弹的是“{snapshot.unstableStep}”。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
            <Badge tone="gold">{snapshot.membership.statusLabel}</Badge>
          </div>
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

      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Main Chart</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">三档会员差在哪</h2>
            <p className="mt-2 text-sm leading-6 text-slate">主图只做能力项 × 3 档会员对比，不靠长文解释。</p>
          </div>
          <p className="text-sm leading-6 text-slate">红看最卡，橙看未稳，蓝看推进，绿看已稳。</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-line">
          <div className="grid grid-cols-[1.3fr_repeat(3,0.7fr)] bg-mist/70 px-4 py-3 text-sm font-semibold text-ink">
            <p>能力项</p>
            <p className="text-center">试用</p>
            <p className="text-center">自助会员</p>
            <p className="text-center">陪跑会员</p>
          </div>
          {snapshot.capabilityRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.3fr_repeat(3,0.7fr)] items-center border-t border-line bg-white px-4 py-4 text-sm">
              <p className="font-medium text-ink">{row.label}</p>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.trial].className}`}>{capabilityLabel[row.trial].text}</span>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.selfService].className}`}>{capabilityLabel[row.selfService].text}</span>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.coaching].className}`}>{capabilityLabel[row.coaching].text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {snapshot.tiers.map((tier) => (
          <SectionCard key={tier.slug} title={tier.title} subtitle={tier.highlight}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-mist/40 px-4 py-4">
                <p className="text-sm font-semibold text-ink">适合谁</p>
                <p className="mt-2 text-sm leading-7 text-slate">{tier.fits}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">能得到什么</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate">
                  {tier.gets.map((item) => (
                    <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
                  ))}
                </ul>
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
        membershipTier={snapshot.membership.tier}
        tierStatus={snapshot.membership.tierStatus}
      />

      <SectionCard title="顺手就能接下去的入口" subtitle="只留必要入口，不把你带回功能堆里。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/student-home" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">回孩子首页</p>
            <p className="mt-2 text-sm leading-6 text-slate">孩子自己打开，也知道今天先做什么。</p>
          </Link>
          <Link href="/parent-overview" className="rounded-3xl border border-line bg-mist px-5 py-5">
            <p className="text-lg font-semibold text-ink">回家长总览</p>
            <p className="mt-2 text-sm leading-6 text-slate">先看这周最该盯哪一步。</p>
          </Link>
          <Link href="/timeline" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">看证据时间轴</p>
            <p className="mt-2 text-sm leading-6 text-slate">别靠感觉，顺着证据看最稳。</p>
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
