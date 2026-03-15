"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminTrackingSnapshot } from "@/lib/types";

export function OperationsGrowthPanel({ tracking }: { tracking: AdminTrackingSnapshot }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activateIntent(id: number) {
    setLoading(`activate-${id}`);
    setError(null);
    const response = await fetch(`/api/admin/tracking-intents/${id}`, { method: "PATCH" });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这次开通状态没改进去。");
      setLoading(null);
      return;
    }
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <p className="text-lg font-semibold text-ink">谁点了继续追踪</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate">
          {tracking.clicks.length > 0 ? tracking.clicks.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="font-semibold text-ink">{item.studentName} · {item.parentName}</p>
              <p>{item.eventName} · 诊断 #{item.diagnosisId}</p>
            </div>
          )) : <p>当前还没人点继续追踪。</p>}
        </div>
      </section>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <p className="text-lg font-semibold text-ink">谁提交了开通意向</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate">
          {tracking.intents.length > 0 ? tracking.intents.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="font-semibold text-ink">{item.studentName} · {item.parentName}</p>
              <p>状态：{item.status} · {item.requestedWeeks} 周</p>
              <p>{item.note ?? "这次没补备注。"}</p>
              {item.status !== "activated" ? (
                <button type="button" onClick={() => activateIntent(item.id)} disabled={loading === `activate-${item.id}`} className="mt-3 rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {loading === `activate-${item.id}` ? "我在标记开通..." : "标记已开通"}
                </button>
              ) : <p className="mt-2 text-accent">这条已经开通。</p>}
            </div>
          )) : <p>当前还没有开通意向。</p>}
        </div>
      </section>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <p className="text-lg font-semibold text-ink">谁已开通</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate">
          {tracking.activeStudents.length > 0 ? tracking.activeStudents.map((item) => (
            <div key={`${item.studentId}-${item.id}`} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">
              <p className="font-semibold">{item.studentName} · {item.parentName}</p>
              <p>当前状态：{item.trackingStatus}</p>
            </div>
          )) : <p>当前还没有已开通学生。</p>}
        </div>
      </section>
      {error ? <p className="text-sm text-rose lg:col-span-3">{error}</p> : null}
    </div>
  );
}
