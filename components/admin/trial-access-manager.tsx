"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminTrialAccessItem, Subject } from "@/lib/types";

const SUBJECT_OPTIONS: Subject[] = ["math", "english"];

export function TrialAccessManager({ items }: { items: AdminTrialAccessItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(item: AdminTrialAccessItem, formData: FormData) {
    setPendingId(item.id);
    setError(null);

    const enabledSubjects = SUBJECT_OPTIONS.filter((subject) => formData.get(`subject-${item.id}-${subject}`) === "on");
    const enabledGrades = String(formData.get(`grades-${item.id}`) || "")
      .split(/[，,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const response = await fetch(`/api/admin/trial-access/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whitelistEnabled: formData.get(`enabled-${item.id}`) === "on",
        freeTrialTotal: Number(formData.get(`total-${item.id}`) || 0),
        freeTrialUsed: Number(formData.get(`used-${item.id}`) || 0),
        maxImagesPerUpload: Number(formData.get(`images-${item.id}`) || 1),
        enabledGrades,
        enabledSubjects
      })
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这次没存进去，我再帮你试一次。");
      setPendingId(null);
      return;
    }

    router.refresh();
    setPendingId(null);
  }

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <form key={item.id} action={(formData) => handleSave(item, formData)} className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-ink">{item.studentName}</p>
              <p className="mt-2 text-sm leading-6 text-slate">家长：{item.userName} · 年级：{item.grade ?? "未填"}</p>
              <p className="text-sm leading-6 text-slate">手机号：{item.phone ?? "未填"} · 邀请码：{item.inviteCode ?? "未填"}</p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm text-ink">
              <input type="checkbox" name={`enabled-${item.id}`} defaultChecked={item.whitelistEnabled} />
              白名单启用
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">总试用次数</span>
              <input name={`total-${item.id}`} type="number" min="0" defaultValue={item.freeTrialTotal} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">已用次数</span>
              <input name={`used-${item.id}`} type="number" min="0" defaultValue={item.freeTrialUsed} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">单次最多上传</span>
              <input name={`images-${item.id}`} type="number" min="1" defaultValue={item.maxImagesPerUpload} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
            </label>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">开放年级</span>
              <input name={`grades-${item.id}`} defaultValue={item.enabledGrades.join(", ")} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
              <p className="mt-2 text-xs text-slate">用逗号隔开，比如：七年级, 八年级</p>
            </label>
            <div>
              <span className="mb-2 block text-sm font-medium text-ink">开放科目</span>
              <div className="flex flex-wrap gap-3 rounded-2xl border border-line bg-mist/50 px-4 py-4 text-sm text-ink">
                {SUBJECT_OPTIONS.map((subject) => (
                  <label key={subject} className="inline-flex items-center gap-2">
                    <input type="checkbox" name={`subject-${item.id}-${subject}`} defaultChecked={item.enabledSubjects.includes(subject)} />
                    {subject === "math" ? "数学" : "英语"}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pendingId === item.id} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pendingId === item.id ? "我在保存..." : "保存白名单设置"}
            </button>
            <span className="text-sm text-slate">剩余：{item.freeTrialRemaining} 次</span>
          </div>
        </form>
      ))}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}

