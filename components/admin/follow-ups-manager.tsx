"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  FollowupActionType,
  FollowupBoardSnapshot,
  FollowupLeadDetail,
  LeadFollowupStatus
} from "@/lib/types";

const statusOptions: Array<{ value: LeadFollowupStatus; label: string }> = [
  { value: "new_intent", label: "新意向" },
  { value: "contacted", label: "已联系" },
  { value: "follow_up_pending", label: "待回访" },
  { value: "activated", label: "已开通" },
  { value: "not_needed", label: "暂不需要" },
  { value: "rejected", label: "拒绝" }
];

const actionOptions: Array<{ value: FollowupActionType; label: string }> = [
  { value: "wechat_contacted", label: "微信已联系" },
  { value: "phone_contacted", label: "电话已联系" },
  { value: "follow_up_pending", label: "待回访" },
  { value: "timeline_sent", label: "已发送时间轴截图" },
  { value: "advice_sent", label: "已发送建议" },
  { value: "parent_hesitating", label: "家长犹豫" },
  { value: "parent_rejected", label: "家长拒绝" },
  { value: "activated", label: "已开通" }
];

function statusLabel(status: LeadFollowupStatus) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function sourceLabel(value: string) {
  switch (value) {
    case "click_continue_tracking":
      return "结果页点了继续追踪";
    case "tracking_intent":
      return "提交了开通意向";
    case "timeline_cta":
      return "时间轴页 CTA";
    case "compare_cta":
      return "结果对比页 CTA";
    default:
      return value;
  }
}

function formatLocalDate(value: string | null) {
  if (!value) return "还没记";
  return new Date(value).toLocaleString("zh-CN");
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function ReminderStrip({ title, items }: { title: string; items: FollowupLeadDetail[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate">
        {items.length > 0 ? items.map((item) => (
          <div key={`${title}-${item.id}`} className="rounded-2xl bg-mist px-3 py-3">
            <p className="font-semibold text-ink">{item.studentName} / {item.parentName}</p>
            <p>{item.latestBlockPoint}</p>
            <p>下次回访：{formatLocalDate(item.nextFollowUpAt)}</p>
          </div>
        )) : <p>这块现在还没有要提醒的线索。</p>}
      </div>
    </div>
  );
}

function TemplateCard({ title, body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(body).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-7 text-slate">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-3">{body}</p>
      <button type="button" onClick={copy} className="mt-4 rounded-2xl border border-line bg-mist px-4 py-2 text-sm font-semibold text-ink">
        {copied ? "已复制" : "复制模板"}
      </button>
    </div>
  );
}

function LeadCard({ item, onSaved, loadingKey }: { item: FollowupLeadDetail; onSaved: (id: number) => Promise<void>; loadingKey: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-slate" data-testid={`followup-lead-${item.id}`}>
      <div className="space-y-1">
        <p className="font-semibold text-ink">{item.parentName} / {item.studentName}</p>
        <p>家长账号：{item.parentEmail}</p>
        <p>student_id {item.studentId} / 学生代号 {item.studentCode}</p>
        <p>年级 / 科目：{item.grade ?? "未写"} / {item.subject ?? "未定"}{item.module ? ` / ${item.module}` : ""}</p>
        <p>来源入口：{sourceLabel(item.sourceType)} / source_type {item.sourceType} / source_ref_id {item.sourceRefId ?? "-"}</p>
        <p>当前状态：{statusLabel(item.status)}</p>
        <p>最后联系时间：{formatLocalDate(item.lastContactAt)}</p>
        <p>下次回访时间：{formatLocalDate(item.nextFollowUpAt)}</p>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl bg-mist px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">最近时间轴结论摘要</p>
          <p className="mt-2 text-ink">{item.latestEvidenceSummary}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当前最主要卡点</p>
            <p className="mt-2 text-ink">{item.latestBlockPoint}</p>
          </div>
          <div className="rounded-2xl border border-line px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">本周变化一句话</p>
            <p className="mt-2 text-ink">{item.weeklyChangeSummary}</p>
          </div>
          <div className="rounded-2xl border border-line px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">还没稳的一步</p>
            <p className="mt-2 text-ink">{item.unstableStep}</p>
          </div>
          <div className="rounded-2xl border border-line px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">建议继续追踪理由</p>
            <p className="mt-2 text-ink">{item.continueTrackingReason}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">状态</span>
          <select name={`followup-status-${item.id}`} defaultValue={item.status} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">这次动作</span>
          <select name={`followup-action-${item.id}`} defaultValue="follow_up_pending" className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent">
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">备注</span>
          <textarea name={`followup-note-${item.id}`} defaultValue={item.followUpNote ?? ""} rows={3} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent" placeholder="比如：家长说先看看时间轴截图，今晚再回。" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">下次提醒时间</span>
          <input type="datetime-local" name={`followup-next-${item.id}`} defaultValue={toDateTimeLocal(item.nextFollowUpAt)} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">拒绝 / 暂不需要原因</span>
          <input name={`followup-rejection-${item.id}`} defaultValue={item.rejectionReason ?? ""} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none focus:border-accent" placeholder="比如：家长说这周先不继续，下次月考后再看。" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onSaved(item.id)} disabled={loadingKey === String(item.id)} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loadingKey === String(item.id) ? "我在记这条跟进..." : "保存这条跟进"}
        </button>
        <span className="text-sm text-slate">每次动作都会记谁操作、什么时间、备注和下次提醒。</span>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6 text-slate">
        <p className="font-semibold text-ink">最近动作记录</p>
        {item.actions.length > 0 ? item.actions.map((action) => (
          <div key={action.id} className="rounded-2xl border border-line px-3 py-3">
            <p className="font-semibold text-ink">{action.operatorName} / {formatLocalDate(action.createdAt)}</p>
            <p>{actionOptions.find((option) => option.value === action.actionType)?.label ?? action.actionType}</p>
            <p>{action.note ?? "这次没补额外备注。"}</p>
            <p>下次提醒：{formatLocalDate(action.remindAt)}</p>
          </div>
        )) : <p>这条线索还没有新的动作记录。</p>}
      </div>
    </div>
  );
}

export function FollowUpsManager({ snapshot }: { snapshot: FollowupBoardSnapshot }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => ([
    { key: "new_intent" as const, title: "新意向", items: snapshot.columns.new_intent },
    { key: "contacted" as const, title: "已联系", items: snapshot.columns.contacted },
    { key: "follow_up_pending" as const, title: "待回访", items: snapshot.columns.follow_up_pending },
    { key: "activated" as const, title: "已开通", items: snapshot.columns.activated },
    { key: "not_needed" as const, title: "暂不需要", items: snapshot.columns.not_needed },
    { key: "rejected" as const, title: "拒绝", items: snapshot.columns.rejected }
  ]), [snapshot.columns]);

  async function save(id: number) {
    const status = (document.querySelector(`select[name="followup-status-${id}"]`) as HTMLSelectElement | null)?.value as LeadFollowupStatus | undefined;
    const actionType = (document.querySelector(`select[name="followup-action-${id}"]`) as HTMLSelectElement | null)?.value as FollowupActionType | undefined;
    const note = (document.querySelector(`textarea[name="followup-note-${id}"]`) as HTMLTextAreaElement | null)?.value ?? "";
    const nextFollowUpAt = (document.querySelector(`input[name="followup-next-${id}"]`) as HTMLInputElement | null)?.value ?? "";
    const rejectionReason = (document.querySelector(`input[name="followup-rejection-${id}"]`) as HTMLInputElement | null)?.value ?? "";

    setLoadingKey(String(id));
    setError(null);
    const response = await fetch(`/api/admin/followups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        actionType,
        note,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
        rejectionReason
      })
    });
    const result = await response.json() as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "这条跟进我没记进去，你再点一下就行。");
      setLoadingKey(null);
      return;
    }
    router.refresh();
    setLoadingKey(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <ReminderStrip title={snapshot.reminders.overdue.title} items={snapshot.reminders.overdue.items} />
        <ReminderStrip title={snapshot.reminders.today.title} items={snapshot.reminders.today.items} />
        <ReminderStrip title={snapshot.reminders.tomorrow.title} items={snapshot.reminders.tomorrow.items} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {snapshot.templates.map((template) => (
          <TemplateCard key={template.id} title={template.title} body={template.body} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {columns.map((column) => (
          <section key={column.key} data-testid={`followup-column-${column.key}`} className="rounded-2xl border border-line bg-mist/40 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-ink">{column.title}</p>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink">{column.items.length}</span>
            </div>
            <div className="mt-4 space-y-4">
              {column.items.length > 0 ? column.items.map((item) => (
                <LeadCard key={item.id} item={item} onSaved={save} loadingKey={loadingKey} />
              )) : <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-5 text-sm leading-6 text-slate">这一列现在还没有线索。</p>}
            </div>
          </section>
        ))}
      </div>

      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}
