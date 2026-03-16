"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MembershipTier, MembershipTierStatus, TrackingStatus } from "@/lib/types";

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
  trackingStatus,
  membershipTier,
  tierStatus
}: {
  diagnosisId: number;
  recheckHref: string;
  fallbackHref: string;
  source: string;
  trackingStatus: TrackingStatus;
  membershipTier: MembershipTier;
  tierStatus: MembershipTierStatus;
}) {
  const router = useRouter();
  const [intentNote, setIntentNote] = useState("");
  const [intentStatus, setIntentStatus] = useState<string | null>(
    membershipTier === "coaching" && tierStatus === "active"
      ? "这位孩子已经在陪跑会员里了，老师人工纠偏和更高频跟进会继续按周接。"
      : membershipTier === "self_service" && tierStatus === "active"
        ? "这位孩子已经在自助会员里了，这条线会继续按周报、自动复检和时间轴接下去。"
        : null
  );
  const [submitting, setSubmitting] = useState<"self_service" | "coaching" | null>(null);
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

  async function submitIntent(requestedTier: MembershipTier) {
    if (requestedTier === "trial") {
      return;
    }

    setSubmitting(requestedTier);
    setIntentStatus(null);
    const response = await fetch("/api/tracking-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagnosisId,
        requestedWeeks: 4,
        requestedTier,
        note: intentNote || null
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setIntentStatus(result.message ?? "这条会员申请我先没记进去，你再点一下就行。");
      setSubmitting(null);
      return;
    }

    setIntentStatus(requestedTier === "coaching"
      ? "陪跑会员申请我先记下来了。后台确认后，老师人工纠偏和高优先级跟进才会一起生效。"
      : "自助会员申请我先记下来了。后台确认后，这条线的周报、自动复检和时间轴就会接上。");
    setSubmitting(null);
  }

  const isCoachingActive = membershipTier === "coaching" && tierStatus === "active";
  const isSelfServiceActive = membershipTier === "self_service" && tierStatus === "active";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Decision</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">
          {trackingStatus === "trial" ? "先决定要不要把这条线接成长线" : "这条线继续往下走，还是直接升级服务强度"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate">
          {trackingStatus === "trial"
            ? "试用只先看这一次体检。要继续拿周报、自动复检和时间轴，就得先开到自助会员以上。"
            : isCoachingActive
              ? "现在已经在陪跑会员里了，重点不是再做选择，而是顺着这条线继续跑。"
              : "这条线已经能自动往下接了。如果后面发现还是回弹得勤，就从这里直接往陪跑会员升级。"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" data-testid="tracking-offer-continue" onClick={handleContinue} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
            {isCoachingActive ? "继续按陪跑节奏练" : isSelfServiceActive ? "继续按自助会员节奏练" : "先看这次建议"}
          </button>
          <button type="button" data-testid="tracking-offer-take-advice" onClick={handleTakeAdvice} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">
            先回这周总结
          </button>
        </div>
      </div>

      <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Intent</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">
          {trackingStatus === "trial" ? "你是想先开自助会员，还是直接问陪跑" : "这条线还要不要往陪跑会员升级"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate">
          你哪怕现在还没完全决定，也可以先留一句最担心的点。后台会按会员申请去接，不是只记一条空意向。
        </p>
        <textarea
          value={intentNote}
          onChange={(event) => setIntentNote(event.target.value)}
          rows={4}
          placeholder="比如：我最担心这块看着会了，过几天又掉回去。"
          className="mt-4 w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => submitIntent(isSelfServiceActive ? "coaching" : "self_service")}
            disabled={submitting !== null || isCoachingActive}
            className="rounded-2xl border border-accent bg-white px-5 py-3 text-sm font-semibold text-accent disabled:opacity-60"
          >
            {isCoachingActive ? "当前已是陪跑会员" : submitting === "self_service" ? "我在记这条自助申请..." : isSelfServiceActive ? "升级陪跑会员" : "申请自助会员"}
          </button>
          <button
            type="button"
            onClick={() => submitIntent("coaching")}
            disabled={submitting !== null || isCoachingActive}
            className="rounded-2xl border border-line bg-mist px-5 py-3 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {submitting === "coaching" ? "我在记这条陪跑咨询..." : "咨询陪跑会员"}
          </button>
        </div>
        {intentStatus ? <p className="mt-3 text-sm leading-6 text-slate">{intentStatus}</p> : null}
      </div>
    </div>
  );
}
