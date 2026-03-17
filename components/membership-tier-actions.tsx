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
          ? "会员页：家长想直接咨询陪跑，重点是希望老师帮着盯。"
          : "会员页：家长先申请自助会员，想把这条线继续接下去。"
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "这条会员申请我先没记进去，你再点一下就行。");
      setSubmitting(null);
      return;
    }

    setMessage(requestedTier === "coaching"
      ? "陪跑申请已经记下。后台确认后，老师会一起帮着盯，提醒也会更紧。"
      : "继续跟的申请已经记下。后台确认后，这条线的每周小结、自动回看和变化记录会继续接上。");
    setSubmitting(null);
    router.refresh();
  }

  const isCoachingActive = membershipTier === "coaching" && tierStatus === "active";
  const isSelfServiceActive = membershipTier === "self_service" && tierStatus === "active";
  const isPending = tierStatus === "pending";
  const primaryIsCoaching = isCoachingActive || isSelfServiceActive;

  return (
    <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">下一步怎么接</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">先决定怎么接着盯</h2>
      <p className="mt-2 text-sm leading-6 text-slate">这里只留一个主按钮。先把最适合你现在的那一步接上。</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {!primaryIsCoaching ? (
          <button
            type="button"
            data-testid="membership-apply-self-service"
            onClick={() => submitIntent("self_service")}
            disabled={submitting !== null || isSelfServiceActive || isCoachingActive || isPending || !diagnosisId}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "后台处理中" : submitting === "self_service" ? "正在记录自助申请..." : "继续让系统陪着盯"}
          </button>
        ) : (
          <button
            type="button"
            data-testid="membership-contact-companion"
            onClick={isCoachingActive ? () => router.push(continueTrackingHref) : () => submitIntent("coaching")}
            disabled={submitting !== null || !diagnosisId}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isCoachingActive ? "继续按陪跑节奏走" : submitting === "coaching" ? "正在记录陪跑咨询..." : "想升级陪跑会员"}
          </button>
        )}

        {!primaryIsCoaching ? (
          <button
            type="button"
            data-testid="membership-contact-companion"
            onClick={() => submitIntent("coaching")}
            disabled={submitting !== null || !diagnosisId}
            className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-slate disabled:opacity-60"
          >
            {submitting === "coaching" ? "正在记录陪跑咨询..." : "看看陪跑多了什么"}
          </button>
        ) : (
          <button
            type="button"
            data-testid="membership-apply-self-service"
            disabled
            className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-slate/70 disabled:opacity-80"
          >
            {isCoachingActive ? "当前已是陪跑会员" : "当前已是自助会员"}
          </button>
        )}
      </div>

      {message ? <p className="mt-4 text-sm leading-6 text-slate">{message}</p> : null}
      {!diagnosisId ? <p className="mt-4 text-sm leading-6 text-slate">这位孩子还没先拿到一条正式结果，我先不乱记申请。先把第一条结果跑出来更稳。</p> : null}
    </div>
  );
}
