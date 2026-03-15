export const dynamic = "force-dynamic";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { getAdminOverview } from "@/lib/db/admin";

const modules = [
  { href: "/admin/whitelist", title: "白名单与试用额度", detail: "看每个学生是否放行、次数剩多少、每次能传几张。" },
  { href: "/admin/students", title: "学生列表", detail: "把孩子档案、最近上传、最近诊断和记忆标签摆在一起看。" },
  { href: "/admin/operations", title: "审核与成本", detail: "把 review queue、模型调用、失败记录和估算成本收在一处。" },
  { href: "/admin/assets", title: "素材库管理", detail: "按标签维护 skill assets，控制付费可见开关。" },
  { href: "/admin/recheck-tasks", title: "复检任务占位", detail: "先把下一轮入口留好，这轮不做复检业务。" }
];

export default function AdminHomePage() {
  const overview = getAdminOverview();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Admin Console</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">运营后台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这里不做花哨大屏，只把白名单、学生、审核成本和素材库理清，让试用运营不乱。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="开放试用" subtitle="当前白名单开启学生数">
          <p className="text-4xl font-semibold text-ink">{overview.trialOpen}</p>
        </SectionCard>
        <SectionCard title="学生档案" subtitle="当前总学生数">
          <p className="text-4xl font-semibold text-ink">{overview.students}</p>
        </SectionCard>
        <SectionCard title="待处理审核" subtitle="pending / edited">
          <p className="text-4xl font-semibold text-ink">{overview.pendingReviews}</p>
        </SectionCard>
        <SectionCard title="素材总数" subtitle="skill assets">
          <p className="text-4xl font-semibold text-ink">{overview.assets}</p>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel transition hover:border-accent/40 hover:shadow-lg">
            <p className="text-lg font-semibold text-ink">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-slate">{item.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
