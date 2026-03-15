export const dynamic = "force-dynamic";

import { FollowUpsManager } from "@/components/admin/follow-ups-manager";
import { SectionCard } from "@/components/section-card";
import { getLeadFollowupSummary } from "@/lib/db/a4";

export default function AdminFollowUpsPage() {
  const followups = getLeadFollowupSummary();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Follow Ups</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">继续追踪跟进台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这里不做支付，只把线索接住。谁刚有意向、谁联系过了、谁要回访、谁已经开通，都顺着学生和家长挂起来看。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SectionCard title="新意向" subtitle="刚点进来">
          <p className="text-3xl font-semibold text-ink">{followups.newIntent}</p>
        </SectionCard>
        <SectionCard title="已联系" subtitle="联系过一次">
          <p className="text-3xl font-semibold text-ink">{followups.contacted}</p>
        </SectionCard>
        <SectionCard title="待回访" subtitle="下次继续跟">
          <p className="text-3xl font-semibold text-ink">{followups.followUpPending}</p>
        </SectionCard>
        <SectionCard title="已开通" subtitle="已转 4 周追踪">
          <p className="text-3xl font-semibold text-ink">{followups.activated}</p>
        </SectionCard>
        <SectionCard title="暂不需要 / 拒绝" subtitle="先放下">
          <p className="text-3xl font-semibold text-ink">{followups.rejected}</p>
        </SectionCard>
      </div>

      <SectionCard title="当前跟进列表" subtitle="按学生和家长挂起来管理，不让线索掉地上">
        <FollowUpsManager items={followups.items} />
      </SectionCard>
    </div>
  );
}
