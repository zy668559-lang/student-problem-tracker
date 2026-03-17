export const dynamic = "force-dynamic";

import { SectionCard } from "@/components/section-card";
import { MembershipTierActions } from "@/components/membership-tier-actions";
import { Badge } from "@/components/ui/badge";
import { getMembershipPageSnapshot } from "@/lib/db/a5";
import { getActiveStudentId, getServerSession } from "@/lib/session";

const capabilityLabel = {
  off: { text: "未开", className: "bg-mist text-slate border-line" },
  limited: { text: "轻", className: "bg-[#f59e0b]/12 text-[#b45309] border-[#f59e0b]/25" },
  on: { text: "有", className: "bg-sky-100 text-sky-700 border-sky-200" },
  high: { text: "强", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
} as const;

function cleanSurfaceText(text: string | null | undefined, fallback: string) {
  let value = (text ?? "")
    .replace(/\b(?:timeline|role-shell|overview|student|membership|heartbeat|followup|closure|recheck|upload)[-_][a-z0-9-]+\b/gi, " ")
    .replace(/\b(?:student_id|timeline_key|task_id|diagnosis_id)\b\s*[\u003A\uFF1A-]?\s*[a-z0-9-]*/gi, " ")
    .replace(/[\u201C\u201D"'`]/g, "")
    .replace(/[\uFF03#]\d+/g, "")
    .replace(/\u5b66\u751f\u81ea\u8ff0/gu, "")
    .replace(/\u8bc1\u636e\u65f6\u95f4\u8f74/gu, "\u53d8\u5316\u8bb0\u5f55")
    .replace(/\u65f6\u95f4\u8f74/gu, "\u53d8\u5316\u8bb0\u5f55")
    .replace(/\u5b9a\u5411\u7d20\u6750/gu, "配套练习")
    .replace(/\u7d20\u6750\u63a8\u8350/gu, "配套练习")
    .replace(/\u8001\u5e08\u7ea0\u504f/gu, "老师帮你盯")
    .replace(/\u5468\u62a5/gu, "每周小结")
    .replace(/\u81ea\u52a8\u590d\u68c0/gu, "自动回看")
    .replace(/\u590d\u68c0/gu, "??")
    .replace(/\u7ee7\u7eed\u8ffd\u8e2a/gu, "继续跟")
    .replace(/\s{2,}/g, " ")
    .trim();

  for (let index = 0; index < 2; index += 1) {
    value = value.replace(/^[^\u003A\uFF1A\n]{0,24}[\u003A\uFF1A]\s*/, "").trim();
  }

  value = value
    .replace(/^[\uFF0C\u3002\uFF1B\u3001\s]+|[\uFF0C\u3002\uFF1B\u3001\s]+$/g, "")
    .replace(/[\uFF0C\u3002\uFF1B\u3001]\s*[\uFF0C\u3002\uFF1B\u3001]+/g, "\uFF0C")
    .trim();

  if (!value) {
    return fallback;
  }

  if (value.includes("\u4e0d\u518d\u770b\u4e00\u8f6e")) {
    return "\u8fd9\u4e00\u6b65\u8fd8\u5f97\u56de\u5934\u518d\u770b\uff0c\u4e0d\u7136\u5f88\u5bb9\u6613\u6389\u56de\u53bb";
  }

  if (value.includes("\u4f1a\u4e00\u534a") || value.includes("\u57fa\u672c\u7a33\u4f4f")) {
    return "\u4e0b\u8f6e\u5148\u628a\u8fd9\u7c7b\u9898\u62c9\u5230\u57fa\u672c\u7a33\u4f4f";
  }

  if (value.includes("\u7ee7\u7eed\u8ffd\u8e2a") && value.includes("\u56de\u5f39")) {
    return "\u8fd9\u6761\u7ebf\u8fd8\u4e0d\u80fd\u653e\u624b\uff0c\u4e0d\u7ee7\u7eed\u8ffd\u5c31\u5bb9\u6613\u56de\u5f39";
  }

  return value;
}

function summarizeSurfaceText(text: string | null | undefined, fallback: string, maxLength = 26) {
  let value = cleanSurfaceText(text, fallback);
  const firstSentence = value
    .split(/[\u3002\uFF01\uFF1F!?]/)
    .map((item) => item.trim())
    .find(Boolean);

  if (firstSentence) {
    value = firstSentence;
  }

  if (value.length > maxLength) {
    const firstClause = value
      .split(/[\uFF0C,]/)
      .map((item) => item.trim())
      .find((item) => item.length > 0);

    if (firstClause && firstClause.length >= 6) {
      value = firstClause;
    }
  }

  if (value.length > maxLength) {
    value = `${value.slice(0, maxLength).trim()}…`;
  }

  return value;
}

export default async function MembershipPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const snapshot = getMembershipPageSnapshot(studentId);

  const currentBlockPoint = summarizeSurfaceText(snapshot.currentBlockPoint, "这一步最卡", 18);
  const unstableStep = "这一步最怕回弹";
  const membershipLabel = cleanSurfaceText(snapshot.membership.label, "这条线已经接上会员节奏。");

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8" data-testid="membership-status">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">怎么接更合适</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">先看差异</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">先看三档差在哪，再决定这条线怎么接。当前最卡“{currentBlockPoint}”，最怕回弹“{unstableStep}”。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone={snapshot.membership.tone}>{snapshot.membership.tierLabel}</Badge>
            <Badge tone="gold">{snapshot.membership.statusLabel}</Badge>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-line bg-mist/40 px-5 py-4">
          <p className="text-sm font-semibold text-ink">当前档位状态</p>
          <p className="mt-2 text-sm leading-6 text-slate">{membershipLabel}</p>
        </div>
      </section>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">三种方式一眼看懂</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">三档会员差在哪</h2>
          <p className="mt-2 text-sm leading-6 text-slate">主图只做能力项 × 3 档会员对比，不再重复铺说明。</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-line">
          <div className="grid grid-cols-[1.3fr_repeat(3,0.7fr)] bg-mist/70 px-4 py-3 text-sm font-semibold text-ink">
            <p>能力项</p>
            <p className="text-center">试用</p>
            <p className="text-center">自助会员</p>
            <p className="text-center">陪跑会员</p>
          </div>
          {snapshot.capabilityRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.3fr_repeat(3,0.7fr)] items-center border-t border-line bg-white px-4 py-4 text-sm">
              <p className="font-medium text-ink">{cleanSurfaceText(row.label, "能力项")}</p>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.trial].className}`}>{capabilityLabel[row.trial].text}</span>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.selfService].className}`}>{capabilityLabel[row.selfService].text}</span>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${capabilityLabel[row.coaching].className}`}>{capabilityLabel[row.coaching].text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        {snapshot.tiers.map((tier) => (
          <SectionCard key={tier.slug} title={cleanSurfaceText(tier.title, "会员档位")} subtitle={cleanSurfaceText(tier.highlight, "先看差异，再决定怎么接。")}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-mist/40 px-4 py-4">
                <p className="text-sm font-semibold text-ink">适合谁</p>
                <p className="mt-2 text-sm leading-7 text-slate">{cleanSurfaceText(tier.fits, "看这条线值不值得继续追。")}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">能得到什么</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate">
                  {tier.gets.map((item) => (
                    <li key={item} className="rounded-2xl border border-line px-4 py-3">{cleanSurfaceText(item, "这条线会继续接上。")}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm font-semibold text-ink">和上一层差在哪</p>
                <p className="mt-2 text-sm leading-7 text-slate">{cleanSurfaceText(tier.difference, "差别在于接得更深、更稳。")}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <MembershipTierActions
        diagnosisId={snapshot.latestDiagnosisId}
        continueTrackingHref={snapshot.continueTrackingHref}
        membershipTier={snapshot.membership.tier}
        tierStatus={snapshot.membership.tierStatus}
      />
    </div>
  );
}