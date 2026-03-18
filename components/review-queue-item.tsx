"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";
import type { ReviewQueueItem } from "@/lib/types";

export function ReviewQueueItemCard({ item }: { item: ReviewQueueItem }) {
  const router = useRouter();
  const [payloadText, setPayloadText] = useState(JSON.stringify(item.payload, null, 2));
  const [reviewNotes, setReviewNotes] = useState(item.reviewNotes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateReview(action: "approve" | "edit" | "reject") {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/review/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, payloadText, reviewNotes })
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这次没存进去，我再帮你试一次。");
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <article className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.reviewStatus === "approved" ? "accent" : item.reviewStatus === "rejected" ? "rose" : "gold"}>
              {reviewStatusLabel(item.reviewStatus)}
            </Badge>
            <span className="text-sm text-slate">{subjectLabel(item.subject)} / {item.module}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-ink">{item.studentName}</h3>
          <p className="mt-2 text-sm text-slate">家长：{item.parentName} · 生成时间：{formatDate(item.createdAt)} · 置信度 {(item.confidence * 100).toFixed(0)}%</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <a href={`/review-draft/${item.id}`} className="text-accent">查看草稿页</a>
          {item.officialDiagnosisId ? <a href={`/diagnosis/${item.officialDiagnosisId}`} className="text-ink">查看正式诊断</a> : null}
        </div>
      </div>

      <textarea
        value={payloadText}
        onChange={(event) => setPayloadText(event.target.value)}
        rows={16}
        className="mt-5 w-full rounded-3xl border border-line bg-[#0f172a] px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-accent"
      />

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-ink">审核备注</span>
        <textarea
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
          rows={3}
          placeholder="例如：这次我把孩子最容易乱的那一步单独拎出来了。"
          className="w-full rounded-2xl border border-line bg-mist/60 px-4 py-3 text-sm outline-none transition focus:border-accent"
        />
      </label>

      {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => updateReview("approve")} disabled={loading} className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">通过并正式入库</button>
        <button type="button" onClick={() => updateReview("edit")} disabled={loading} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">修改草稿</button>
        <button type="button" onClick={() => updateReview("reject")} disabled={loading} className="rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose disabled:cursor-not-allowed disabled:opacity-60">驳回</button>
      </div>
    </article>
  );
}
