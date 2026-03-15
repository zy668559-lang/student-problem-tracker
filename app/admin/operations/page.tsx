export const dynamic = "force-dynamic";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { getAdminOperationsSnapshot } from "@/lib/db/admin";
import { getReviewQueue } from "@/lib/db";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";

export default function AdminOperationsPage() {
  const operations = getAdminOperationsSnapshot();
  const reviewQueue = getReviewQueue();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Operations</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">审核与成本</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这里把审核队列、模型调用、失败记录和估算成本放一起。运营看这里，就知道是不是既控住了质量，也控住了成本。</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="模型调用数" subtitle="累计调用">
          <p className="text-4xl font-semibold text-ink">{operations.totalCalls}</p>
        </SectionCard>
        <SectionCard title="失败数" subtitle="success = false">
          <p className="text-4xl font-semibold text-ink">{operations.failedCalls}</p>
        </SectionCard>
        <SectionCard title="估算成本" subtitle="累计估算">
          <p className="text-4xl font-semibold text-ink">￥ {operations.estimatedCost.toFixed(2)}</p>
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
                <p>耗时：{item.latencyMs} ms · 估算成本：￥ {item.estimatedCost.toFixed(4)}</p>
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
    </div>
  );
}
