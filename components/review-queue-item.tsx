"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";
import type { ReviewQueueItem } from "@/lib/types";

export function ReviewQueueItemCard({ item }: { item: ReviewQueueItem }) {
  const router = useRouter();
  const [payloadText, setPayloadText] = useState(JSON.stringify(item.payload, null, 2));
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
      body: JSON.stringify({ action, payloadText })
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "提交失败");
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
          <p className="mt-2 text-sm text-slate">生成时间：{formatDate(item.createdAt)} · 置信度 {(item.confidence * 100).toFixed(0)}%</p>
        </div>
        <a href={`/diagnosis/${item.id}`} className="text-sm font-semibold text-accent">
          查看诊断页
        </a>
      </div>

      <textarea
        value={payloadText}
        onChange={(event) => setPayloadText(event.target.value)}
        rows={16}
        className="mt-5 w-full rounded-3xl border border-line bg-[#0f172a] px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-accent"
      />

      {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => updateReview("approve")}
          disabled={loading}
          className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          通过
        </button>
        <button
          type="button"
          onClick={() => updateReview("edit")}
          disabled={loading}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          修改并保存
        </button>
        <button
          type="button"
          onClick={() => updateReview("reject")}
          disabled={loading}
          className="rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose disabled:cursor-not-allowed disabled:opacity-60"
        >
          驳回
        </button>
      </div>
    </article>
  );
}
