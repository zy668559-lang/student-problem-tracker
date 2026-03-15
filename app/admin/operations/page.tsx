export const dynamic = "force-dynamic";

import Link from "next/link";
import { OperationsGrowthPanel } from "@/components/admin/operations-growth-panel";
import { SectionCard } from "@/components/section-card";
import { getAdminOperationsSnapshot } from "@/lib/db/admin";
import { listTrackingSnapshotAdmin } from "@/lib/db/p25";
import { getReviewQueue } from "@/lib/db";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";

export default function AdminOperationsPage() {
  const operations = getAdminOperationsSnapshot();
  const reviewQueue = getReviewQueue();
  const tracking = listTrackingSnapshotAdmin();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Operations</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">审核、成本与继续追踪</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这里把审核队列、模型调用、失败记录、估算成本、周报批处理和继续追踪转化都放一起。运营看这一页，就知道质量、成本和成交承接有没有同时站住。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="模型调用数" subtitle="累计调用">
          <p className="text-4xl font-semibold text-ink">{operations.totalCalls}</p>
        </SectionCard>
        <SectionCard title="失败数" subtitle="success = false">
          <p className="text-4xl font-semibold text-ink">{operations.failedCalls}</p>
        </SectionCard>
        <SectionCard title="估算成本" subtitle="累计估算">
          <p className="text-4xl font-semibold text-ink">¥ {operations.estimatedCost.toFixed(2)}</p>
        </SectionCard>
        <SectionCard title="平均耗时" subtitle="毫秒">
          <p className="text-4xl font-semibold text-ink">{operations.averageLatencyMs}</p>
        </SectionCard>
      </div>

      <SectionCard title="审核队列" subtitle="review queue">
        <div className="space-y-4">
          {reviewQueue.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line px-4 py-4 text-sm leading-6 text-slate">
              <p className="font-semibold text-ink">{item.studentName} · {subjectLabel(item.subject)} / {item.module}</p>
              <p className="mt-1">状态：{reviewStatusLabel(item.reviewStatus)} · 置信度 {(item.confidence * 100).toFixed(0)}% · {formatDate(item.createdAt)}</p>
              <Link href={`/diagnosis/${item.id}`} className="mt-2 inline-block text-sm font-semibold text-accent">去看这条诊断</Link>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="最近模型调用" subtitle="model_call_logs">
          <div className="space-y-4 text-sm leading-6 text-slate">
            {operations.latestCalls.map((item) => (
              <div key={item.id} className="rounded-2xl border border-line px-4 py-4">
                <p className="font-semibold text-ink">{item.provider} / {item.modelName}</p>
                <p>模式：{item.diagnosisMode} · Prompt：{item.promptVersion}</p>
                <p>耗时：{item.latencyMs} ms · 估算成本：¥ {item.estimatedCost.toFixed(4)}</p>
                <p>时间：{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="失败记录" subtitle="排查模型异常">
          <div className="space-y-4 text-sm leading-6 text-slate">
            {operations.latestFailures.length > 0 ? operations.latestFailures.map((item) => (
              <div key={item.id} className="rounded-2xl border border-rose/20 bg-rose/5 px-4 py-4">
                <p className="font-semibold text-ink">{item.provider} / {item.modelName}</p>
                <p>错误码：{item.errorCode ?? "未回传"}</p>
                <p>重试次数：{item.retryCount} · 时间：{formatDate(item.createdAt)}</p>
              </div>
            )) : <p className="text-slate">当前还没有失败记录。</p>}
          </div>
        </SectionCard>
      </div>

      <OperationsGrowthPanel tracking={tracking} />

      <SectionCard title="管理员操作日志" subtitle="谁、什么时间、做了什么">
        <div className="space-y-4 text-sm leading-6 text-slate">
          {operations.latestActions.length > 0 ? operations.latestActions.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line px-4 py-4">
              <p className="font-semibold text-ink">{item.actorName} · {item.actorRole}</p>
              <p>{item.actionType} / {item.targetType}{item.targetId ? ` #${item.targetId}` : ""}</p>
              <p>{item.detail}</p>
              <p>{formatDate(item.createdAt)}</p>
            </div>
          )) : <p className="text-slate">当前还没有管理员操作日志。</p>}
        </div>
      </SectionCard>
    </div>
  );
}
