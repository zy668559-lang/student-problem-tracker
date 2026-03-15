export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAdminOverview } from "@/lib/db/admin";

const cards = [
  { href: "/admin/whitelist", title: "白名单与试用额度", detail: "看每个学生是否放行、次数剩多少、每次能传几张。" },
  { href: "/admin/students", title: "学生列表", detail: "把孩子档案、最近上传、最近诊断和记忆标签摆在一起看。" },
  { href: "/admin/operations", title: "审核、成本与继续追踪", detail: "把 review queue、模型调用、周报批处理和继续追踪意向放在一处。" },
  { href: "/admin/assets", title: "素材库管理", detail: "按标签维护 skill assets，控制付费可见开关。" },
  { href: "/admin/recheck-tasks", title: "复检任务台", detail: "老师能直接把复检任务纠偏，改成已稳住、未稳住或继续轰炸。" },
  { href: "/admin/follow-ups", title: "跟进漏斗", detail: "把新意向、已联系、待回访、已开通和拒绝都按学生挂起来看。" }
];

export default function AdminOverviewPage() {
  const snapshot = getAdminOverview();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">运营后台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这边主要盯四件事：谁能进、谁在传、谁还没稳、谁准备继续追踪。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate">开放中的试用名额</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{snapshot.trialOpen}</p>
        </div>
        <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate">学生档案数</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{snapshot.students}</p>
        </div>
        <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate">待审核诊断</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{snapshot.pendingReviews}</p>
        </div>
        <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate">素材条数</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{snapshot.assets}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel transition hover:-translate-y-0.5 hover:shadow-lg">
            <p className="text-lg font-semibold text-ink">{card.title}</p>
            <p className="mt-3 text-sm leading-7 text-slate">{card.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
