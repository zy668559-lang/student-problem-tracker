"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadFollowupDetail, LeadFollowupStatus } from "@/lib/types";

const statusOptions: Array<{ value: LeadFollowupStatus; label: string }> = [
  { value: "new_intent", label: "新意向" },
  { value: "contacted", label: "已联系" },
  { value: "follow_up_pending", label: "待回访" },
  { value: "activated", label: "已开通" },
  { value: "not_needed", label: "暂不需要" },
  { value: "rejected", label: "拒绝" }
];

function statusLabel(status: LeadFollowupStatus) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

export function FollowUpsManager({ items }: { items: LeadFollowupDetail[] }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(item: LeadFollowupDetail) {
    const statusValue = (document.querySelector(`select[name="followup-status-${item.id}"]`) as HTMLSelectElement | null)?.value as LeadFollowupStatus | undefined;
    const noteValue = (document.querySelector(`textarea[name="followup-note-${item.id}"]`) as HTMLTextAreaElement | null)?.value ?? "";
    const rejectionValue = (document.querySelector(`input[name="followup-rejection-${item.id}"]`) as HTMLInputElement | null)?.value ?? "";
    setLoadingKey(String(item.id));
    setError(null);

    const response = await fetch(`/api/admin/follow-ups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusValue ?? item.status,
        followUpNote: noteValue,
        rejectionReason: rejectionValue
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这条跟进我没改进去，你再点一下。");
      setLoadingKey(null);
      return;
    }

    router.refresh();
    setLoadingKey(null);
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-slate" data-testid={`lead-followup-${item.id}`}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-ink">{item.studentName} · {item.userName}</p>
              <p>当前状态：{statusLabel(item.status)} · 来源：{item.clickSource} · 意向时间：{new Date(item.intentAt).toLocaleString("zh-CN")}</p>
              <p>关联：诊断 {item.diagnosisId ?? "-"} / 复检 {item.recheckTaskId ?? "-"}</p>
            </div>
            <div className="text-sm text-slate">
              <p>上次联系：{item.lastContactAt ? new Date(item.lastContactAt).toLocaleString("zh-CN") : "还没跟"}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">跟进状态</span>
              <select name={`followup-status-${item.id}`} defaultValue={item.status} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">跟进备注</span>
              <textarea name={`followup-note-${item.id}`} defaultValue={item.followUpNote ?? ""} rows={3} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent" placeholder="比如：家长说这周先观察，周末再联系。" />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-ink">拒绝 / 暂不需要原因</span>
            <input name={`followup-rejection-${item.id}`} defaultValue={item.rejectionReason ?? ""} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent" placeholder="比如：这轮先不继续追踪，等下次月考后再说。" />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => save(item)} disabled={loadingKey === String(item.id)} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {loadingKey === String(item.id) ? "我在保存跟进..." : "保存跟进"}
            </button>
            <span className="text-sm text-slate">系统会把“已开通 / 暂不需要 / 拒绝”同步回继续追踪状态。</span>
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}
