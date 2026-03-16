"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MembershipTier, MembershipTierStatus } from "@/lib/types";

export function MembershipTierActions({
  diagnosisId,
  continueTrackingHref,
  membershipTier,
  tierStatus
}: {
  diagnosisId: number | null;
  continueTrackingHref: string;
  membershipTier: MembershipTier;
  tierStatus: MembershipTierStatus;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"self_service" | "coaching" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitIntent(requestedTier: MembershipTier) {
    if (!diagnosisId || submitting || requestedTier === "trial") {
      return;
    }

    setSubmitting(requestedTier);
    setMessage(null);
    const response = await fetch("/api/tracking-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagnosisId,
        requestedWeeks: 4,
        requestedTier,
        note: requestedTier === "coaching"
          ? "会员分层页：想直接咨询陪跑会员，重点想要老师人工纠偏。"
          : "会员分层页：先申请自助会员，把这条线持续接起来。"
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "这条会员申请我先没记进去，你再点一下就行。");
      setSubmitting(null);
      return;
    }

    setMessage(requestedTier === "coaching"
      ? "陪跑会员申请我先记下来了。后台确认后，老师人工纠偏和更高频跟进才会一起生效。"
      : "自助会员申请我先记下来了。后台确认后，这条线的周报、自动复检和时间轴才会继续接上。");
    setSubmitting(null);
    router.refresh();
  }

  const isCoachingActive = membershipTier === "coaching" && tierStatus === "active";
  const isSelfServiceActive = membershipTier === "self_service" && tierStatus === "active";
  const isPending = tierStatus === "pending";

  return (
    <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Action</p>
      <h2 className="mt-3 text-2xl font-semibold text-ink">先把这条线要怎么接，说清楚。</h2>
      <p className="mt-3 text-sm leading-7 text-slate">
        这一页现在只做三件事：看清当前层级、递开通申请、决定要不要直接问陪跑。正式支付这轮先不接。
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="membership-apply-self-service"
          onClick={() => submitIntent("self_service")}
          disabled={submitting !== null || isSelfServiceActive || isCoachingActive || isPending || !diagnosisId}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isCoachingActive ? "当前已是陪跑会员" : isSelfServiceActive ? "当前已是自助会员" : isPending ? "后台处理中" : submitting === "self_service" ? "我在记这条自助申请..." : "申请开通自助会员"}
        </button>
        <button
          type="button"
          data-testid="membership-contact-companion"
          onClick={isCoachingActive ? () => router.push(continueTrackingHref) : () => submitIntent("coaching")}
          disabled={submitting !== null || !diagnosisId}
          className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {isCoachingActive ? "回陪跑节奏页" : submitting === "coaching" ? "我在记这条陪跑咨询..." : "联系咨询陪跑"}
        </button>
      </div>

      {message ? <p className="mt-4 text-sm leading-6 text-slate">{message}</p> : null}
      {!diagnosisId ? <p className="mt-4 text-sm leading-6 text-slate">这位孩子这边还没落下一条正式诊断，我先不乱记会员申请，先去跑出一条结果更稳。</p> : null}
    </div>
  );
}
