export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { DiagnosisResultActions } from "@/components/diagnosis-result-actions";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getLatestWeeklyReport } from "@/lib/db";
import { getMemorySummary } from "@/lib/db/memory";
import { getEnhancedDiagnosisDetail, getRecommendedSkillAssetByDiagnosis } from "@/lib/db/product";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";

export default async function DiagnosisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const diagnosis = getEnhancedDiagnosisDetail(Number(id));

  if (!diagnosis) notFound();

  const latestReportId = getLatestWeeklyReport(diagnosis.studentId);
  const recommendedAsset = getRecommendedSkillAssetByDiagnosis(diagnosis.id);
  const memory = diagnosis.studentId ? getMemorySummary(diagnosis.studentId) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Diagnosis</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">{diagnosis.studentName} 的诊断结果</h1>
            <p className="mt-3 text-sm leading-7 text-slate">{subjectLabel(diagnosis.subject)} / {diagnosis.module} · {formatDate(diagnosis.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="accent">置信度 {(diagnosis.confidence * 100).toFixed(0)}%</Badge>
            <Badge tone={diagnosis.reviewStatus === "approved" ? "accent" : diagnosis.reviewStatus === "rejected" ? "rose" : "gold"}>{reviewStatusLabel(diagnosis.reviewStatus)}</Badge>
            <Badge tone="ink">{diagnosis.diagnosisMode}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="这次更像卡在哪" subtitle="先说人话，不拐弯">
          <p className="text-base leading-8 text-ink">{diagnosis.currentStage}</p>
        </SectionCard>
        <SectionCard title="这周先改哪一步" subtitle="动作只留一个起手重点">
          <p className="text-base leading-8 text-ink">{diagnosis.repairActions[0] ?? "这次先把第一条错因压住。"}</p>
        </SectionCard>
        <SectionCard title="先看这个" subtitle="只推 1 个最贴近这次卡点的素材">
          {recommendedAsset ? (
            <div className="space-y-3 text-sm leading-6 text-slate">
              <p className="text-lg font-semibold text-ink">{recommendedAsset.title}</p>
              <p>{recommendedAsset.summary}</p>
              <p>标签：{recommendedAsset.tag}</p>
              <p>{recommendedAsset.paidOnly ? "这条是付费追踪内素材。" : "这条这次可以先免费看看。"}</p>
            </div>
          ) : <p className="text-sm leading-7 text-slate">这次先不额外推素材，我先把诊断和动作给你落下来。</p>}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="上传信息" subtitle="这次我是按什么线索判断的">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <p><span className="font-semibold text-ink">文件：</span>{diagnosis.fileName}</p>
            <p><span className="font-semibold text-ink">分数备注：</span>{diagnosis.scoreNote ?? "这次没填也没关系"}</p>
            <p><span className="font-semibold text-ink">学生自述：</span>{diagnosis.studentSelfReport ?? "这次没写，我先按题图判断了。"}</p>
            <p><span className="font-semibold text-ink">卡点轻自评：</span>{diagnosis.stuckPointChoice ?? "这次没选，我先帮你自动判断。"}</p>
            <p><span className="font-semibold text-ink">步骤状态：</span>{diagnosis.hasSteps ? `${diagnosis.stepQuality}（有步骤）` : "none（没给步骤）"}</p>
          </div>
        </SectionCard>
        <SectionCard title="家长摘要" subtitle="我直接把这次判断说透">
          <p className="text-base leading-8 text-ink">{diagnosis.parentSummary}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="问题标签" subtitle="这次最需要盯住的点">
          <div className="flex flex-wrap gap-3">
            {diagnosis.problemTags.map((item) => <Badge key={item} tone="rose">{item}</Badge>)}
          </div>
        </SectionCard>
        <SectionCard title="修复动作" subtitle="别贪多，这几条够用了">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {diagnosis.repairActions.map((item) => <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>)}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="复检状态" subtitle="这轮先看它到底稳了没">
          <p className="text-base leading-8 text-ink">{diagnosis.recheckSummary ?? memory?.recheck_status_summary ?? "这次先挂上复检，下一轮回头看有没有真稳住。"}</p>
        </SectionCard>
        <SectionCard title="下轮优先级" subtitle="下一轮最该先盯谁">
          <p className="text-base leading-8 text-ink">{diagnosis.nextPriority ?? memory?.next_priority ?? "下一轮还是先盯这次主卡点。"}</p>
        </SectionCard>
        <SectionCard title="继续追踪理由" subtitle="为什么不建议只看这一条就停">
          <p className="text-base leading-8 text-ink">{diagnosis.continueTrackingReason ?? memory?.next_recheck_reason ?? "因为这类题最容易出现看着有起色，过两天又掉回去。"}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="今天先做哪一步" subtitle="学生版，只留一个起手动作">
          <p className="text-base leading-8 text-ink">{diagnosis.studentTodayAction ?? diagnosis.repairActions[0] ?? "今天先把第一步做顺。"}</p>
        </SectionCard>
        <SectionCard title="再练 1 个最小动作" subtitle="别铺太多，先把一个小点练透">
          <p className="text-base leading-8 text-ink">{diagnosis.studentMinimumAction ?? diagnosis.nextActionType ?? "再练 1 道最接近这次卡点的同类题。"}</p>
        </SectionCard>
        <SectionCard title="做完怎么自检" subtitle="做完别只看对错，要看稳没稳">
          <p className="text-base leading-8 text-ink">{diagnosis.studentSelfCheck ?? "做完回头问自己：我是不是比上次更知道卡哪了？"}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="AI 初判" subtitle="先保留模型第一反应，后面可对比">
          <pre className="overflow-x-auto rounded-3xl bg-[#0f172a] p-5 text-sm leading-7 text-slate-100">{JSON.stringify(diagnosis.draftDiagnosis, null, 2)}</pre>
        </SectionCard>
        <SectionCard title="审核归档版" subtitle="老师确认后，家长端以后都按这版看">
          {diagnosis.approvedDiagnosis ? (
            <pre className="overflow-x-auto rounded-3xl bg-[#0f172a] p-5 text-sm leading-7 text-slate-100">{JSON.stringify(diagnosis.approvedDiagnosis, null, 2)}</pre>
          ) : (
            <p className="text-sm leading-7 text-slate">这条还没进入正式归档版，先按 AI 初判看。</p>
          )}
          {diagnosis.reviewNotes ? <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm leading-6 text-ink">审核备注：{diagnosis.reviewNotes}</p> : null}
        </SectionCard>
      </div>

      <DiagnosisResultActions diagnosisId={diagnosis.id} assetId={recommendedAsset?.id ?? null} assetTitle={recommendedAsset?.title ?? null} />

      <div className="flex flex-wrap gap-3">
        <Link href="/review-queue" className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">前往审核台</Link>
        <Link href={latestReportId ? `/weekly-report/${latestReportId}` : "/dashboard"} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">查看周总结</Link>
      </div>
    </div>
  );
}
