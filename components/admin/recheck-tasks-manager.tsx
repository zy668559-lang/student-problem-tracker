"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecheckManualDecision, RecheckTaskDetail } from "@/lib/types";

const decisionOptions: Array<{ value: RecheckManualDecision; label: string }> = [
  { value: "stabilized", label: "已稳住" },
  { value: "unstable", label: "未稳住" },
  { value: "bombing", label: "继续轰炸" }
];

function statusLabel(value: string) {
  switch (value) {
    case "recheck_due":
      return "本周必须再检";
    case "passed_once":
      return "有进步，但还没稳";
    case "stabilized":
      return "已稳住";
    case "improving":
      return "有进步，继续盯";
    case "dismissed":
      return "已撤销";
    default:
      return "已挂复检";
  }
}

export function RecheckTasksManager({ items }: { items: RecheckTaskDetail[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(task: RecheckTaskDetail, formData: FormData) {
    setPendingId(task.id);
    setError(null);
    const response = await fetch(`/api/admin/recheck-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: formData.get(`decision-${task.id}`),
        manualPriority: formData.get(`priority-${task.id}`),
        reason: formData.get(`reason-${task.id}`)
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这条人工纠偏没存进去，我再帮你试一次。");
      setPendingId(null);
      return;
    }
    router.refresh();
    setPendingId(null);
  }

  return (
    <div className="space-y-4">
      {items.length > 0 ? items.map((task) => (
        <form key={task.id} action={(formData) => submit(task, formData)} className="rounded-3xl border border-line bg-white p-5" data-testid={`recheck-task-${task.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink">{task.studentName} · {task.tag || task.module}</p>
              <p className="mt-1 text-sm text-slate">{task.subject} / {task.module} / {statusLabel(task.status)} / 诊断 #{task.latestDiagnosisId ?? task.diagnosisId ?? "-"}</p>
            </div>
            <div className="text-right text-sm text-slate">
              <p>7 天重复：{task.repeatCount7d}</p>
              <p>30 天重复：{task.repeatCount30d}</p>
              <p>稳住分：{task.stabilizedScore}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3 text-sm leading-6 text-slate">
            <div className="rounded-2xl bg-mist px-4 py-3 text-ink">{task.triggerReason}</div>
            <div className="rounded-2xl border border-line px-4 py-3">{task.nextPriority}</div>
            <div className="rounded-2xl border border-line px-4 py-3">{task.continueTrackingReason}</div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">人工处理</span>
              <select name={`decision-${task.id}`} defaultValue={task.manualOverrideStatus ?? "unstable"} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent">
                {decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-sm font-medium text-ink">手动改优先级</span>
              <input name={`priority-${task.id}`} defaultValue={task.manualOverridePriority ?? task.nextPriority} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-ink">老师原因</span>
            <textarea name={`reason-${task.id}`} defaultValue={task.manualOverrideReason ?? task.nextRecheckReason} rows={3} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pendingId === task.id} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pendingId === task.id ? "我在写回这条复检..." : "保存人工纠偏"}
            </button>
            {task.manualOverrideAt ? <span className="text-sm text-slate">上次人工处理：{new Date(task.manualOverrideAt).toLocaleString("zh-CN")}</span> : null}
          </div>
        </form>
      )) : <p className="text-sm leading-7 text-slate">暂时还没有复检任务，先等下一条诊断生成。</p>}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}
