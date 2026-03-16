"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MembershipAdminSnapshot, MembershipManagementAction, MembershipTier } from "@/lib/types";

const actionOptions: Array<{ value: MembershipManagementAction; label: string }> = [
  { value: "open", label: "手动开通" },
  { value: "extend", label: "手动延期" },
  { value: "downgrade", label: "手动降级" },
  { value: "pause", label: "手动暂停" }
];

const tierOptions: Array<{ value: MembershipTier; label: string }> = [
  { value: "trial", label: "试用" },
  { value: "self_service", label: "自助会员" },
  { value: "coaching", label: "陪跑会员" }
];

export function MembershipManager({ snapshot }: { snapshot: MembershipAdminSnapshot }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(studentId: number) {
    const action = (document.querySelector(`select[name="membership-action-${studentId}"]`) as HTMLSelectElement | null)?.value as MembershipManagementAction | undefined;
    const membershipTier = (document.querySelector(`select[name="membership-tier-${studentId}"]`) as HTMLSelectElement | null)?.value as MembershipTier | undefined;
    const effectiveTo = (document.querySelector(`input[name="membership-effective-${studentId}"]`) as HTMLInputElement | null)?.value ?? "";
    const reason = (document.querySelector(`textarea[name="membership-reason-${studentId}"]`) as HTMLTextAreaElement | null)?.value ?? "";

    setPendingKey(studentId);
    setError(null);
    const response = await fetch(`/api/admin/memberships/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        membershipTier,
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
        reason
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这条会员状态我没改进去，你再点一下就行。");
      setPendingKey(null);
      return;
    }

    router.refresh();
    setPendingKey(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {snapshot.items.map((item) => (
          <section key={item.studentId} data-testid={`membership-card-${item.studentId}`} className="rounded-3xl border border-line bg-white p-5 shadow-panel">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xl font-semibold text-ink">{item.studentName} / {item.parentName}</p>
                <p className="mt-1 text-sm leading-6 text-slate">{item.parentEmail}</p>
                <p className="mt-2 text-sm leading-6 text-slate">当前：{item.membership.tierLabel} / {item.membership.statusLabel}</p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3 text-sm leading-6 text-slate">
                <p>生效起点：{item.membership.effectiveFrom ? new Date(item.membership.effectiveFrom).toLocaleString("zh-CN") : "未写"}</p>
                <p>到期时间：{item.membership.effectiveTo ? new Date(item.membership.effectiveTo).toLocaleString("zh-CN") : "未设"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3 text-sm leading-6 text-slate">
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当前最主要卡点</p>
                <p className="mt-2 text-ink">{item.latestBlockPoint}</p>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">本周变化一句话</p>
                <p className="mt-2 text-ink">{item.weeklyChangeSummary}</p>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">还没稳的一步</p>
                <p className="mt-2 text-ink">{item.unstableStep}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">操作</span>
                <select name={`membership-action-${item.studentId}`} defaultValue="open" className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent">
                  {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">目标层级</span>
                <select name={`membership-tier-${item.studentId}`} defaultValue={item.membership.membershipTier} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent">
                  {tierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">到期时间</span>
                <input type="datetime-local" name={`membership-effective-${item.studentId}`} defaultValue={item.membership.effectiveTo ? new Date(new Date(item.membership.effectiveTo).getTime() - new Date(item.membership.effectiveTo).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-ink">备注原因</span>
              <textarea name={`membership-reason-${item.studentId}`} defaultValue={item.membership.manualOverrideReason ?? ""} rows={3} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" placeholder="比如：家长确认只开自助会员，先不进老师陪跑。" />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" data-testid={`membership-save-${item.studentId}`} onClick={() => save(item.studentId)} disabled={pendingKey === item.studentId} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {pendingKey === item.studentId ? "我在写回这条会员状态..." : "保存会员状态"}
              </button>
              <span className="text-sm text-slate">这次会自动记操作人、操作前后状态和备注。</span>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel" data-testid="membership-logs">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent/70">Logs</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">最近会员状态操作记录</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate">
          {snapshot.recentLogs.map((item) => (
            <div key={item.id} className="rounded-2xl border border-line px-4 py-4">
              <p className="font-semibold text-ink">{item.studentName} / {item.actorName}</p>
              <p>操作：{item.actionType}</p>
              <p>操作前：{item.beforeState ? `${item.beforeState.membershipTier} / ${item.beforeState.tierStatus}` : "无"}</p>
              <p>操作后：{item.afterState ? `${item.afterState.membershipTier} / ${item.afterState.tierStatus}` : "无"}</p>
              <p>备注：{item.note ?? "这次没补备注。"}</p>
              <p>时间：{new Date(item.createdAt).toLocaleString("zh-CN")}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}
