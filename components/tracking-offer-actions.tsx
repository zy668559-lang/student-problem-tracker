"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TrackingStatus } from "@/lib/types";

async function postEvent(payload: { diagnosisId: number; eventName: string; eventValue?: string | null }) {
  await fetch("/api/result-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export function TrackingOfferActions({
  diagnosisId,
  recheckHref,
  fallbackHref,
  source,
  trackingStatus
}: {
  diagnosisId: number;
  recheckHref: string;
  fallbackHref: string;
  source: string;
  trackingStatus: TrackingStatus;
}) {
  const router = useRouter();
  const [intentNote, setIntentNote] = useState("");
  const [intentStatus, setIntentStatus] = useState<string | null>(trackingStatus === "active" ? "这位孩子已经在继续追踪里了，我这边会按周继续盯。" : null);
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<number>(Date.now());
  const viewedSentRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    postEvent({ diagnosisId, eventName: "opened_tracking_offer", eventValue: `from:${source}` });

    const timer = window.setTimeout(() => {
      viewedSentRef.current = true;
      postEvent({ diagnosisId, eventName: "viewed_tracking_offer_complete", eventValue: `stay_ms:${Date.now() - startRef.current}` });
    }, 6000);

    const onPageHide = () => {
      postEvent({ diagnosisId, eventName: "exit_tracking_offer", eventValue: `stay_ms:${Date.now() - startRef.current}` });
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", onPageHide);
      if (!viewedSentRef.current) {
        postEvent({ diagnosisId, eventName: "exit_tracking_offer", eventValue: `stay_ms:${Date.now() - startRef.current}` });
      }
    };
  }, [diagnosisId, source]);

  async function handleContinue() {
    await postEvent({ diagnosisId, eventName: "click_tracking_offer_continue", eventValue: `from:${source}` });
    router.push(recheckHref);
  }

  async function handleTakeAdvice() {
    await postEvent({ diagnosisId, eventName: "click_tracking_offer_take_advice", eventValue: `from:${source}` });
    router.push(fallbackHref);
  }

  async function submitIntent() {
    setSubmitting(true);
    setIntentStatus(null);
    const response = await fetch("/api/tracking-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnosisId, requestedWeeks: 4, note: intentNote || null })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setIntentStatus(result.message ?? "这条意向我先没记进去，你再点一下就行。");
      setSubmitting(false);
      return;
    }
    setIntentStatus("我先把这条继续追踪意向记下来了，后台会按 4 周追踪去接。");
    setSubmitting(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Decision</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">继续追踪 4 周</h3>
        <p className="mt-3 text-sm leading-7 text-slate">如果你现在想要的不是“这次对没对”，而是“这类问题 4 周后到底稳没稳”，就顺着这条线继续追。我会按周把问题、动作、变化接起来，不让它靠感觉飘。</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" data-testid="tracking-offer-continue" onClick={handleContinue} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
            继续追踪 4 周
          </button>
          <button type="button" data-testid="tracking-offer-take-advice" onClick={handleTakeAdvice} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">
            先拿建议，后面再决定
          </button>
        </div>
      </div>
      <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Intent</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">要是你想先让我记一条意向，也行</h3>
        <p className="mt-3 text-sm leading-7 text-slate">你哪怕现在还没完全决定，也可以先留一句最担心的点。我这边先把它挂进继续追踪漏斗，后面跟进会更顺。</p>
        <textarea
          value={intentNote}
          onChange={(event) => setIntentNote(event.target.value)}
          rows={4}
          placeholder="比如：我最担心这块看着会了，过几天又掉回去。"
          className="mt-4 w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={submitIntent}
          disabled={submitting || trackingStatus === "active"}
          className="mt-4 rounded-2xl border border-accent bg-white px-5 py-3 text-sm font-semibold text-accent disabled:opacity-60"
        >
          {trackingStatus === "active" ? "已开通继续追踪" : submitting ? "我在记这条意向..." : "提交开通意向"}
        </button>
        {intentStatus ? <p className="mt-3 text-sm leading-6 text-slate">{intentStatus}</p> : null}
      </div>
    </div>
  );
}
