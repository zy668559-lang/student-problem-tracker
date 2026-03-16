export const dynamic = "force-dynamic";

import { MembershipManager } from "@/components/admin/membership-manager";
import { SectionCard } from "@/components/section-card";
import { getMembershipAdminSnapshot } from "@/lib/db/membership";

export default function AdminMembershipsPage() {
  const snapshot = getMembershipAdminSnapshot();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Membership</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">会员状态管理台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
          这一页只盯一件事：每个学生现在到底是试用、自助还是陪跑，状态有没有暂停、延期、降级，都能手动改，而且每次都留痕。
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard title="试用" subtitle="当前人数">
          <p className="text-3xl font-semibold text-ink">{snapshot.items.filter((item) => item.membership.membershipTier === "trial").length}</p>
        </SectionCard>
        <SectionCard title="自助会员" subtitle="当前人数">
          <p className="text-3xl font-semibold text-ink">{snapshot.items.filter((item) => item.membership.membershipTier === "self_service").length}</p>
        </SectionCard>
        <SectionCard title="陪跑会员" subtitle="当前人数">
          <p className="text-3xl font-semibold text-ink">{snapshot.items.filter((item) => item.membership.membershipTier === "coaching").length}</p>
        </SectionCard>
        <SectionCard title="待处理" subtitle="pending / paused / expired">
          <p className="text-3xl font-semibold text-ink">{snapshot.items.filter((item) => item.membership.tierStatus !== "active").length}</p>
        </SectionCard>
      </div>

      <MembershipManager snapshot={snapshot} />
    </div>
  );
}
