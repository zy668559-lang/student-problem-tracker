"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContinueTrackingLink } from "@/components/continue-tracking-link";
import type { ResultEventName, SubmissionType, TrackingStatus } from "@/lib/types";

async function postResultEvent(payload: { diagnosisId: number; eventName: ResultEventName; assetId?: number | null; eventValue?: string | null }) {
  await fetch("/api/result-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export function DiagnosisResultActions({
  diagnosisId,
  assetId,
  assetTitle,
  recheckTaskId,
  submissionType,
  trackingStatus
}: {
  diagnosisId: number;
  assetId?: number | null;
  assetTitle?: string | null;
  recheckTaskId?: number | null;
  submissionType?: SubmissionType;
  trackingStatus?: TrackingStatus;
}) {
  const [intentNote, setIntentNote] = useState("");
  const [intentStatus, setIntentStatus] = useState<string | null>(trackingStatus === "active" ? "这位孩子已经在继续追踪里了。" : null);
  const [submitting, setSubmitting] = useState(false);
  const recheckHref = recheckTaskId ? `/recheck/${recheckTaskId}` : "/upload";

  useEffect(() => {
    postResultEvent({ diagnosisId, eventName: "opened_result" });
    const timer = window.setTimeout(() => {
      postResultEvent({ diagnosisId, eventName: submissionType === "recheck" ? "viewed_recheck_result_complete" : "viewed_result_complete" });
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [diagnosisId, submissionType]);

  async function submitIntent() {
    setSubmitting(true);
    setIntentStatus(null);
    const response = await fetch("/api/tracking-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnosisId, recheckTaskId, note: intentNote, requestedWeeks: 4 })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setIntentStatus(result.message ?? "这次意向我没收进去，你再点一下就行。");
      setSubmitting(false);
      return;
    }

    await postResultEvent({ diagnosisId, eventName: "submit_tracking_intent", eventValue: "4-week-tracking" });
    setIntentStatus("我先把这条继续追踪意向记下来了，后台会按 4 周追踪去跟进。 ");
    setSubmitting(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Next Step</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">继续追踪，还是先拿建议</h3>
        <p className="mt-3 text-sm leading-7 text-slate">如果你要继续看变化，下一轮直接走复检入口最省力；如果今天只想先拿建议，也完全可以先停在这。</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ContinueTrackingLink href={recheckHref} diagnosisId={diagnosisId} eventValue={submissionType === "recheck" ? "recheck-to-recheck" : "diagnosis-to-recheck"} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">继续追踪</ContinueTrackingLink>
          <Link href="/dashboard" onClick={() => postResultEvent({ diagnosisId, eventName: "click_only_take_advice" })} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">只拿建议</Link>
        </div>
      </div>
      <div className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Offer</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">继续追踪 4 周</h3>
        <p className="mt-3 text-sm leading-7 text-slate">如果你想看的不是“这次答得对不对”，而是“这类问题到底稳没稳”，4 周追踪会更值，因为问题、动作、变化能连起来看。</p>
        <button type="button" onClick={() => postResultEvent({ diagnosisId, eventName: "paid_conversion", eventValue: "4-week-tracking" })} className="mt-5 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white">我想继续追踪 4 周</button>
        <textarea value={intentNote} onChange={(event) => setIntentNote(event.target.value)} rows={3} placeholder="要是你有补充，比如这周最担心哪一块，也可以顺手写一句。" className="mt-3 w-full rounded-2xl border border-accent/20 bg-white/90 px-4 py-3 text-sm text-ink outline-none focus:border-accent" />
        <button type="button" onClick={submitIntent} disabled={submitting || trackingStatus === "active"} className="mt-3 rounded-2xl border border-accent bg-white px-5 py-3 text-sm font-semibold text-accent disabled:opacity-60">{trackingStatus === "active" ? "已开通继续追踪" : submitting ? "我在记这条意向..." : "提交开通意向"}</button>
        {intentStatus ? <p className="mt-3 text-sm leading-6 text-slate">{intentStatus.trim()}</p> : null}
        {assetId ? (
          <button type="button" onClick={() => postResultEvent({ diagnosisId, eventName: "click_asset", assetId, eventValue: assetTitle ?? null })} className="mt-4 block text-sm font-semibold text-accent">
            先看这个：{assetTitle}
          </button>
        ) : null}
      </div>
    </div>
  );
}
