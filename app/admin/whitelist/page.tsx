export const dynamic = "force-dynamic";

import { TrialAccessManager } from "@/components/admin/trial-access-manager";
import { SectionCard } from "@/components/section-card";
import { listTrialAccessAdmin } from "@/lib/db/admin";

export default function AdminWhitelistPage() {
  const items = listTrialAccessAdmin();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Whitelist</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">白名单与试用额度</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">一行就是一个孩子的试用入口。启停、次数、单次上传张数、年级和科目开关都在这里管。</p>
      </section>

      <SectionCard title="白名单管理" subtitle="trial_access 可视化管理">
        <TrialAccessManager items={items} />
      </SectionCard>
    </div>
  );
}
