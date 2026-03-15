export const dynamic = "force-dynamic";

import { FollowUpsManager } from "@/components/admin/follow-ups-manager";
import { SectionCard } from "@/components/section-card";
import { getFollowupBoardSnapshot } from "@/lib/db/followups";

export default function AdminFollowupsPage() {
  const snapshot = getFollowupBoardSnapshot();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Followups</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">继续追踪跟进 SOP 台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这一页就盯一件事：把有意向的家长接住。谁刚动心、谁联系过、谁该回访、谁已经开通，都顺着孩子的时间轴证据往下跟，不靠拍脑袋。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SectionCard title="新意向" subtitle="刚入池">
          <p className="text-3xl font-semibold text-ink">{snapshot.newIntent}</p>
        </SectionCard>
        <SectionCard title="已联系" subtitle="先接住了">
          <p className="text-3xl font-semibold text-ink">{snapshot.contacted}</p>
        </SectionCard>
        <SectionCard title="待回访" subtitle="还得继续跟">
          <p className="text-3xl font-semibold text-ink">{snapshot.followUpPending}</p>
        </SectionCard>
        <SectionCard title="已开通" subtitle="进入 4 周追踪">
          <p className="text-3xl font-semibold text-ink">{snapshot.activated}</p>
        </SectionCard>
        <SectionCard title="暂不需要 / 拒绝" subtitle="先放一放">
          <p className="text-3xl font-semibold text-ink">{snapshot.rejected}</p>
        </SectionCard>
        <SectionCard title="总线索数" subtitle="followup_leads">
          <p className="text-3xl font-semibold text-ink">{snapshot.total}</p>
        </SectionCard>
      </div>

      <FollowUpsManager snapshot={snapshot} />
    </div>
  );
}
