export const dynamic = "force-dynamic";

import Link from "next/link";
import { ContinueTrackingLink } from "@/components/continue-tracking-link";
import { notFound } from "next/navigation";
import { DiagnosisResultActions } from "@/components/diagnosis-result-actions";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getResultCompareDetail } from "@/lib/db/a4";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const detail = getResultCompareDetail(Number(id), studentId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Compare</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{detail.studentName} 这条复检前后对比</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这一页只回答一件事：上次卡点这次到底有没有往前走，接下来还值不值得继续追踪 4 周。</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="上次主要问题" subtitle="先把起点说清楚">
          <p className="text-base leading-8 text-ink">{detail.lastProblemSummary}</p>
        </SectionCard>
        <SectionCard title="本次复检结果" subtitle="这轮到底变了什么">
          <p className="text-base leading-8 text-ink">{detail.currentRecheckResult}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge tone={detail.compareReady ? "accent" : "gold"}>{detail.compareReady ? "已有前后对比" : "还在等下一次复检"}</Badge>
            <Badge tone="ink">下轮还要不要追踪</Badge>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="已稳住" subtitle="这次先能放心一点的地方">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.stabilizedItems.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="还没稳住" subtitle="这几条先别松手">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.unstableItems.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="下轮优先级" subtitle="下一轮先盯谁">
          <p className="text-base leading-8 text-ink">{detail.nextPriority}</p>
        </SectionCard>
        <SectionCard title="建议继续追踪理由" subtitle="为什么不建议现在就停">
          <p className="text-base leading-8 text-ink">{detail.continueTrackingReason}</p>
        </SectionCard>
        <SectionCard title="先看这个" subtitle="先推 1 个最贴近这条卡点的素材">
          {detail.suggestedAssetTitle ? (
            <div className="space-y-3 text-sm leading-6 text-slate">
              <p className="text-lg font-semibold text-ink">{detail.suggestedAssetTitle}</p>
              <p>{detail.suggestedAssetSummary}</p>
              <p>{detail.suggestedAssetPaidOnly ? "这条更适合放到继续追踪里慢慢吃透。" : "这条这次可以先直接看。"}</p>
            </div>
          ) : <p className="text-sm leading-7 text-slate">这条先不额外推素材，我建议你直接顺着复检动作继续看。</p>}
        </SectionCard>
      </div>

      <DiagnosisResultActions
        diagnosisId={detail.latestDiagnosisId ?? detail.diagnosisId ?? 0}
        assetId={detail.suggestedAssetId}
        assetTitle={detail.suggestedAssetTitle}
        recheckTaskId={detail.taskId}
        submissionType="recheck"
      />

      <div className="flex flex-wrap gap-3">
        <ContinueTrackingLink href={`/recheck/${detail.taskId}`} diagnosisId={detail.latestDiagnosisId ?? detail.diagnosisId} eventValue="compare-to-recheck" className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">继续追踪 4 周</ContinueTrackingLink>
        <Link href={detail.latestWeeklyReportId ? `/weekly-report/${detail.latestWeeklyReportId}` : "/dashboard"} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">看这周周总结</Link>
        <Link href={detail.latestDiagnosisId ? `/diagnosis/${detail.latestDiagnosisId}` : "/dashboard"} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">回看最新诊断</Link>
      </div>
    </div>
  );
}
