"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HeartbeatRunDetail } from "@/lib/types";

function statusLabel(value: string | null | undefined) {
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

export function HeartbeatRunPanel({ recentRun }: { recentRun: HeartbeatRunDetail | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runHeartbeat() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/heartbeat", { method: "POST" });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这次 Heartbeat 没跑起来。" );
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel" data-testid="heartbeat-run-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 text-sm leading-6 text-slate">
          <p className="text-lg font-semibold text-ink">Heartbeat Lite</p>
          <p>这轮先用手动运行 + 系统内轻量触发，不上独立 cron 或 worker。</p>
          <p>
            最近一次：
            <span className="font-semibold text-ink">{statusLabel(recentRun?.status)}</span>
            {recentRun ? ` · 扫描 ${recentRun.studentsScanned} 个学生 · 当前打开 ${recentRun.openEventCount} 条事件` : " · 还没有运行记录"}
          </p>
          <p>{recentRun?.errorMessage ? `失败原因：${recentRun.errorMessage}` : "规则命中会自动落成 inspectable Heartbeat 事件。"}</p>
        </div>
        <button
          type="button"
          data-testid="heartbeat-run-manual"
          onClick={runHeartbeat}
          disabled={loading}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "我在手动跑 Heartbeat..." : "手动运行 Heartbeat 一次"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
    </section>
  );
}

