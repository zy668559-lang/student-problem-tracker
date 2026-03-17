export const dynamic = "force-dynamic";

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
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8" data-testid="membership-status">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Membership</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">先看差异</h1>
            <p className="mt-2 text-base font-medium text-ink">这条线现在最该看的是：不同档位到底差在哪。</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">当前主卡点是“{snapshot.currentBlockPoint}”。这周最怕回弹的是“{snapshot.unstableStep}”。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
            <Badge tone="gold">{snapshot.membership.statusLabel}</Badge>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-line bg-mist/40 px-5 py-4">
          <p className="text-sm font-semibold text-ink">当前档位状态</p>
          <p className="mt-2 text-sm leading-6 text-slate">{snapshot.membership.label}</p>
        </div>
      </section>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Main Chart</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">三档会员差在哪</h2>
            <p className="mt-2 text-sm leading-6 text-slate">主图只做能力项 × 3 档会员对比，不靠长文解释。</p>
          </div>
          <p className="text-sm leading-6 text-slate">{snapshot.weeklyOneLiner}</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-line">
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

      <div className="grid gap-5 xl:grid-cols-3">
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
    </div>
  );
}
