export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getDiagnosisDetail, getLatestWeeklyReport } from "@/lib/db";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";

export default async function DiagnosisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const diagnosis = getDiagnosisDetail(Number(id));

  if (!diagnosis) {
    notFound();
  }

  const latestReportId = getLatestWeeklyReport();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Diagnosis</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">{diagnosis.studentName} 的诊断结果</h1>
            <p className="mt-3 text-sm leading-7 text-slate">
              {subjectLabel(diagnosis.subject)} / {diagnosis.module} · {formatDate(diagnosis.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="accent">置信度 {(diagnosis.confidence * 100).toFixed(0)}%</Badge>
            <Badge tone={diagnosis.reviewStatus === "approved" ? "accent" : diagnosis.reviewStatus === "rejected" ? "rose" : "gold"}>
              {reviewStatusLabel(diagnosis.reviewStatus)}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="阶段判断" subtitle="当前阶段必须能让家长一眼看懂。">
          <p className="text-base leading-8 text-ink">{diagnosis.currentStage}</p>
        </SectionCard>
        <SectionCard title="上传信息" subtitle="追溯本次诊断来源。">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <p><span className="font-semibold text-ink">文件：</span>{diagnosis.fileName}</p>
            <p><span className="font-semibold text-ink">分数备注：</span>{diagnosis.scoreNote ?? "未填写"}</p>
            <p><span className="font-semibold text-ink">学生自述：</span>{diagnosis.studentSelfReport ?? "未填写"}</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="问题标签" subtitle="结构化字段 problem_tags。">
          <div className="flex flex-wrap gap-3">
            {diagnosis.problemTags.map((item) => (
              <Badge key={item} tone="rose">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="修复动作" subtitle="结构化字段 repair_actions。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {diagnosis.repairActions.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="家长摘要" subtitle="结构化字段 parent_summary。">
        <p className="text-base leading-8 text-ink">{diagnosis.parentSummary}</p>
      </SectionCard>

      <SectionCard title="诊断 JSON" subtitle="审核台可直接基于这份 JSON 通过、修改或驳回。">
        <pre className="overflow-x-auto rounded-3xl bg-[#0f172a] p-5 text-sm leading-7 text-slate-100">
          {JSON.stringify(diagnosis.rawJson, null, 2)}
        </pre>
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link href="/review-queue" className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
          前往审核台
        </Link>
        <Link
          href={latestReportId ? `/weekly-report/${latestReportId}` : "/dashboard"}
          className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
        >
          查看周总结
        </Link>
      </div>
    </div>
  );
}

