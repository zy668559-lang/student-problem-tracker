"use client";

import { useEffect } from "react";
import Link from "next/link";

async function postResultEvent(payload: { diagnosisId: number; eventName: string; assetId?: number | null; eventValue?: string | null }) {
  await fetch("/api/result-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => undefined);
}

export function DiagnosisResultActions({ diagnosisId, assetId, assetTitle }: { diagnosisId: number; assetId?: number | null; assetTitle?: string | null }) {
  useEffect(() => {
    postResultEvent({ diagnosisId, eventName: "opened_result" });
    const timer = window.setTimeout(() => {
      postResultEvent({ diagnosisId, eventName: "viewed_result_complete" });
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [diagnosisId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Next Step</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">继续追踪，还是先拿建议</h3>
        <p className="mt-3 text-sm leading-7 text-slate">如果你想继续看变化，就把下一轮错题继续传上来；如果今天只想先拿建议，也完全可以先停在这。</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/upload" onClick={() => postResultEvent({ diagnosisId, eventName: "click_continue_tracking" })} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">继续追踪</Link>
          <Link href="/dashboard" onClick={() => postResultEvent({ diagnosisId, eventName: "click_only_take_advice" })} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">只拿建议</Link>
        </div>
      </div>
      <div className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Offer</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">免费 1 次体检 / 付费 4 周追踪</h3>
        <p className="mt-3 text-sm leading-7 text-slate">如果只是先摸孩子现在卡哪，一次体检就够。要真看变化，还是 4 周追踪更值，因为问题、动作、变化会连起来。</p>
        <button type="button" onClick={() => postResultEvent({ diagnosisId, eventName: "paid_conversion", eventValue: "4-week-tracking" })} className="mt-5 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">我想转 4 周追踪</button>
        {assetId ? (
          <button type="button" onClick={() => postResultEvent({ diagnosisId, eventName: "click_asset", assetId, eventValue: assetTitle ?? null })} className="mt-3 block text-sm font-semibold text-accent">
            先看这个素材：{assetTitle}
          </button>
        ) : null}
      </div>
    </div>
  );
}
