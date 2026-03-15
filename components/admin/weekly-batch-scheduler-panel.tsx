"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WeeklyBatchSchedulerSnapshot } from "@/lib/types";

function statusLabel(value: string | null) {
  switch (value) {
    case "running":
      return "正在跑";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    default:
      return "还没跑过";
  }
}

export function WeeklyBatchSchedulerPanel({ snapshot }: { snapshot: WeeklyBatchSchedulerSnapshot }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerunBatch() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/weekly-batch", { method: "POST" });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这次补跑没起来，我建议你马上再点一次。");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 text-sm leading-6 text-slate">
            <p className="text-lg font-semibold text-ink">周报自动调度</p>
            <p>现在用的是本地定时守门机制。页面一进来会先看这周任务到没到点，到了就自动跑；没到点就只展示状态。</p>
            <p>上次状态：<span className="font-semibold text-ink">{statusLabel(snapshot.lastStatus)}</span> · 下次计划：{new Date(snapshot.nextRunAt).toLocaleString("zh-CN")}</p>
            <p>最近一次产出：{snapshot.lastReportCount} 份周报{snapshot.lastError ? ` · 失败原因：${snapshot.lastError}` : ""}</p>
          </div>
          <button type="button" onClick={rerunBatch} disabled={loading} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "我在补跑本周周报..." : "手动重跑本周周报"}
          </button>
        </div>
      </div>

      <div className="space-y-3 text-sm leading-6 text-slate">
        {snapshot.recentRuns.map((item) => (
          <div key={item.id} className="rounded-2xl border border-line bg-white px-4 py-4" data-testid={`weekly-batch-run-${item.id}`}>
            <p className="font-semibold text-ink">{statusLabel(item.status)} · {item.triggerSource}</p>
            <p>开始：{new Date(item.startedAt).toLocaleString("zh-CN")} · 产出：{item.reportCount} 份</p>
            <p>执行人：{item.triggeredByName ?? "系统自动"}</p>
            <p>{item.errorMessage ? `失败原因：${item.errorMessage}` : "这次没有报错。"}</p>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}
