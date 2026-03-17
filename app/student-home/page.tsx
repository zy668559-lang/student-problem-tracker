export const dynamic = "force-dynamic";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import { getStudentHomeSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

const toneClasses = {
  red: {
    chip: "bg-rose/12 text-rose border-rose/20",
    fill: "bg-rose",
    text: "当前最卡"
  },
  orange: {
    chip: "bg-[#f59e0b]/12 text-[#b45309] border-[#f59e0b]/25",
    fill: "bg-[#f59e0b]",
    text: "还没稳"
  },
  blue: {
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    fill: "bg-sky-500",
    text: "本周推进中"
  },
  green: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    fill: "bg-emerald-500",
    text: "已稳"
  },
  gray: {
    chip: "bg-mist text-slate border-line",
    fill: "bg-slate/35",
    text: "弱信息"
  }
} as const;

function renderStateRail(tone: keyof typeof toneClasses) {
  const activeIndex = {
    red: 0,
    orange: 1,
    blue: 2,
    green: 3,
    gray: -1
  }[tone];

  return (
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={`h-2 rounded-full ${index === activeIndex ? toneClasses[tone].fill : "bg-mist"}`}
        />
      ))}
    </div>
  );
}

export default async function StudentHomePage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getStudentHomeSnapshot(studentId);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8" data-testid="student-home-hero">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">{"\u5b69\u5b50\u770b\u8fd9\u91cc"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">今天先练这一条</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">{snapshot.studentName}，先把“{snapshot.thisWeekAction}”做顺，再看下一步。</p>
            <p className="mt-2 text-sm leading-6 text-slate">
              {snapshot.grade ? `${snapshot.grade}` : "年级待补"}{snapshot.school ? ` / ${snapshot.school}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="rose">今天先练</Badge>
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard title="今天先练这个" subtitle="先做一条，不换线。">
          <p className="text-lg font-semibold text-ink">{snapshot.thisWeekAction}</p>
          <p className="mt-3 text-sm leading-6 text-slate">今天先做顺，不贪多。</p>
        </SectionCard>
        <SectionCard title="最近一次结果" subtitle="只说这次有没有往前。">
          <p className="text-lg font-semibold text-ink">{snapshot.latestRecheckResult}</p>
          <p className="mt-3 text-sm leading-6 text-slate">先看变化，再看解释。</p>
        </SectionCard>
        <SectionCard title="本周重点" subtitle="这一周就盯这一条。">
          <p className="text-lg font-semibold text-ink">{snapshot.currentBlockPoint}</p>
          <p className="mt-3 text-sm leading-6 text-slate">主卡点先不换，压住再说。</p>
        </SectionCard>
        <SectionCard title="下次回看什么" subtitle="下轮回来先看这一项。">
          <p className="text-lg font-semibold text-ink">{snapshot.nextPriority}</p>
          <p className="mt-3 text-sm leading-6 text-slate">下次先回头看它稳没稳。</p>
        </SectionCard>
      </div>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">{"\u8fd9\u5468\u7ec3\u5230\u54ea\u4e86"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">今天先做什么，一眼看懂</h2>
            <p className="mt-2 text-sm leading-6 text-slate">只用 4 档状态条，不做假分数。</p>
          </div>
          <p className="text-sm leading-6 text-slate">{snapshot.weeklyOneLiner}</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {snapshot.studentFocusChart.map((item) => {
            const tone = toneClasses[item.tone];
            return (
              <article key={item.label} className="rounded-3xl border border-line bg-mist/45 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-ink">{item.label}</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.chip}`}>{tone.text}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink">{item.detail}</p>
                <div className="mt-4">{renderStateRail(item.tone)}</div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-panel border border-accent/20 bg-accent/10 p-5 shadow-panel sm:p-8" data-testid="student-home-practice-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">{"\u4eca\u5929\u5148\u505a"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">今天就练这一步</h2>
            <p className="mt-2 text-sm leading-6 text-slate">先练顺这一条，别来回换。</p>
          </div>
          <Link
            href={snapshot.practiceHref}
            data-testid="student-home-practice-link"
            className="inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
          >
            今天先练这个
          </Link>
        </div>
      </section>

      <SectionCard title="还可以看什么" subtitle="入口保留少量，主按钮只留一个。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/timeline" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">{"\u53d8\u5316\u8bb0\u5f55"}</p>
            <p className="mt-2 text-sm leading-6 text-slate">{snapshot.membership.canSeeTimeline ? "把问题、动作和变化顺着看。" : "这一项从自助会员开始开放。"}</p>
          </Link>
          <Link href="/parent-overview" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">家长总览</p>
            <p className="mt-2 text-sm leading-6 text-slate">让家长一眼知道这周先盯哪一步。</p>
          </Link>
          <Link href="/membership" className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">{"\u4e09\u79cd\u65b9\u5f0f\u5dee\u5728\u54ea"}</p>
            <p className="mt-2 text-sm leading-6 text-slate">先看差异，再决定要不要继续追。</p>
          </Link>
          <Link href={snapshot.continueTrackingHref} className="rounded-3xl border border-line bg-white px-5 py-5">
            <p className="text-lg font-semibold text-ink">{snapshot.membership.tier === "trial" ? "申请开通自助会员" : snapshot.membership.tier === "self_service" ? "想升级陪跑会员" : "继续按陪跑节奏走"}</p>
            <p className="mt-2 text-sm leading-6 text-slate">{snapshot.membership.tier === "trial" ? "\u8981\u7ee7\u7eed\u62ff\u6bcf\u5468\u5c0f\u7ed3\u3001\u81ea\u52a8\u590d\u770b\u548c\u53d8\u5316\u8bb0\u5f55\uff0c\u5c31\u4ece\u8fd9\u91cc\u63a5\u4e0b\u53bb\u3002" : snapshot.membership.tier === "self_service" ? "\u5982\u679c\u6700\u6015\u53cd\u590d\uff0c\u4e0b\u4e00\u6b65\u5c31\u95ee\u966a\u8dd1\u3002" : "\u8fd9\u6761\u7ebf\u5df2\u7ecf\u6709\u4eba\u4e00\u8d77\u76ef\u4e86\uff0c\u7ee7\u7eed\u6309\u8fd9\u5468\u4e3b\u7ebf\u8d70\u3002"}</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
