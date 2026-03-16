export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { TrackingOfferActions } from "@/components/tracking-offer-actions";
import { getTrackingOfferDetail } from "@/lib/db/a43";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function ContinueTrackingPage({
  searchParams
}: {
  searchParams: Promise<{ diagnosisId?: string; from?: string; taskId?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const diagnosisId = params.diagnosisId ? Number(params.diagnosisId) : null;
  const from = params.from ?? "timeline";
  const detail = getTrackingOfferDetail(studentId, diagnosisId);

  if (!detail || !detail.diagnosisId) {
    notFound();
  }

  const recheckHref = detail.priorityRecheckTaskId ? `/recheck/${detail.priorityRecheckTaskId}` : "/upload";
  const fallbackHref = detail.latestWeeklyReportId ? `/weekly-report/${detail.latestWeeklyReportId}` : "/dashboard";

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8" data-testid="tracking-offer-hero">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Offer</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{detail.studentName} 这条，为什么我建议继续追踪 4 周</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这页不讲空话，就讲一件事：这条问题现在是不是已经稳了。如果还没稳，我建议别光看一次结果，顺着这条线再追 4 周，才看得出是真进步还是暂时起色。</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="当前最主要问题" subtitle="这次最该先说清楚的点">
          <p className="text-base leading-8 text-ink">{detail.currentProblem}</p>
        </SectionCard>
        <SectionCard title="本周已有变化" subtitle="不是没进步，是得看稳没稳">
          <p className="text-base leading-8 text-ink">{detail.weeklyChange}</p>
        </SectionCard>
        <SectionCard title="还没稳住的一步" subtitle="现在最怕的就是这里回弹">
          <p className="text-base leading-8 text-ink">{detail.unstableStep}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="为什么建议继续追踪 4 周" subtitle="不是为了多做题，是为了把变化看准">
          <div className="space-y-3 text-sm leading-7 text-slate">
            <p>{detail.continueTrackingReason}</p>
            <p>现在最怕的不是这道题今天没做对，而是看着好了一点，过两天又掉回去。4 周追踪的价值，就在于它能把“会了”跟“稳了”分开看。</p>
          </div>
        </SectionCard>
        <SectionCard title="开通后能得到什么" subtitle="你每周能拿到的，不只是一个结论">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.benefits.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="下轮先盯什么" subtitle="别一下铺太多，先盯最关键那一步">
        <p className="text-base leading-8 text-ink">{detail.nextPriority}</p>
      </SectionCard>

      <TrackingOfferActions
        diagnosisId={detail.diagnosisId}
        recheckHref={recheckHref}
        fallbackHref={fallbackHref}
        source={from}
        trackingStatus={detail.trackingStatus}
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/timeline" className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">回看证据时间轴</Link>
        <Link href={fallbackHref} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">先回这周总结</Link>
      </div>
    </div>
  );
}
