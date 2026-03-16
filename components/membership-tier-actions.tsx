"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TrackingStatus } from "@/lib/types";

export function MembershipTierActions({
  diagnosisId,
  continueTrackingHref,
  trackingStatus
}: {
  diagnosisId: number | null;
  continueTrackingHref: string;
  trackingStatus: TrackingStatus;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function applySelfService() {
    if (!diagnosisId || submitting || trackingStatus === "active") {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/tracking-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagnosisId,
        requestedWeeks: 4,
        note: "会员分层页：想先申请自助会员，自己先把这条线盯起来。"
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };

    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "这条开通意向我先没记进去，你再点一下就行。");
      setSubmitting(false);
      return;
    }

    setMessage("这条自助会员意向我先记下来了，接下来你随时可以顺着这条线继续看。");
    setSubmitting(false);
    router.refresh();
  }

  function contactCompanion() {
    router.push(continueTrackingHref);
  }

  return (
    <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Action</p>
      <h2 className="mt-3 text-2xl font-semibold text-ink">先别急着谈支付，先把你要哪种陪法说清楚。</h2>
      <p className="mt-3 text-sm leading-7 text-slate">
        这一页只做三件事：看边界、留意向、继续咨询。正式支付和订阅这轮先不接。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="membership-apply-self-service"
          onClick={applySelfService}
          disabled={submitting || trackingStatus === "active" || !diagnosisId}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {trackingStatus === "active" ? "现在已经在继续追踪里" : submitting ? "我先帮你记一下..." : "申请开通"}
        </button>
        <button
          type="button"
          data-testid="membership-contact-companion"
          onClick={contactCompanion}
          className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink"
        >
          联系咨询
        </button>
      </div>
      {message ? <p className="mt-4 text-sm leading-6 text-slate">{message}</p> : null}
      {!diagnosisId ? <p className="mt-4 text-sm leading-6 text-slate">你这边还没落下一条诊断，我先不乱记意向，先去传一条材料更稳。</p> : null}
    </div>
  );
}
