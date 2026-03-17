export const dynamic = "force-dynamic";

import { AssetsManager } from "@/components/admin/assets-manager";
import { SectionCard } from "@/components/section-card";
import { listSkillAssetsAdmin } from "@/lib/db/admin";

export default function AdminAssetsPage() {
  const items = listSkillAssetsAdmin();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Assets</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">素材库管理</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">素材先放后台，诊断后再按卡点往外推。这里支持增删改查和付费可见开关。</p>
      </section>

      <SectionCard title="skill_assets 管理" subtitle="先把几何 / 函数素材按标签归好类。">
        <AssetsManager items={items} />
      </SectionCard>
    </div>
  );
}