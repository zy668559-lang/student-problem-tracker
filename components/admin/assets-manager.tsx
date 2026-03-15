"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SkillAsset, Subject } from "@/lib/types";

const SUBJECT_OPTIONS: Array<{ value: Subject; label: string }> = [
  { value: "math", label: "数学" },
  { value: "english", label: "英语" }
];

const EMPTY_ASSET = {
  subject: "math" as Subject,
  module: "函数",
  tag: "function_entry_step",
  difficulty: "middle",
  assetType: "worksheet",
  title: "",
  summary: "",
  fileUrl: "/assets/demo.pdf",
  previewUrl: "/assets/demo.png",
  useStage: "diagnosis",
  paidOnly: false
};

export function AssetsManager({ items }: { items: SkillAsset[] }) {
  const router = useRouter();
  const [createState, setCreateState] = useState(EMPTY_ASSET);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createAsset() {
    setLoadingKey("create");
    setError(null);
    const response = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createState)
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "素材这次没建起来，我再帮你试一次。");
      setLoadingKey(null);
      return;
    }
    setCreateState(EMPTY_ASSET);
    router.refresh();
    setLoadingKey(null);
  }

  async function updateAsset(id: number, payload: Omit<SkillAsset, "id">) {
    setLoadingKey(`update-${id}`);
    setError(null);
    const response = await fetch(`/api/admin/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "素材没改成功，我再帮你存一次。");
      setLoadingKey(null);
      return;
    }
    router.refresh();
    setLoadingKey(null);
  }

  async function deleteAsset(id: number) {
    setLoadingKey(`delete-${id}`);
    setError(null);
    const response = await fetch(`/api/admin/assets/${id}`, { method: "DELETE" });
    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setError(result.message ?? "素材删失败了，我先给你保留住。");
      setLoadingKey(null);
      return;
    }
    router.refresh();
    setLoadingKey(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
        <p className="text-lg font-semibold text-ink">新增素材</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">科目</span>
            <select value={createState.subject} onChange={(event) => setCreateState((prev) => ({ ...prev, subject: event.target.value as Subject }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent">
              {SUBJECT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">模块</span>
            <input value={createState.module} onChange={(event) => setCreateState((prev) => ({ ...prev, module: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">标签</span>
            <input value={createState.tag} onChange={(event) => setCreateState((prev) => ({ ...prev, tag: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">难度</span>
            <input value={createState.difficulty} onChange={(event) => setCreateState((prev) => ({ ...prev, difficulty: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">素材类型</span>
            <input value={createState.assetType} onChange={(event) => setCreateState((prev) => ({ ...prev, assetType: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">使用阶段</span>
            <input value={createState.useStage} onChange={(event) => setCreateState((prev) => ({ ...prev, useStage: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">标题</span>
            <input value={createState.title} onChange={(event) => setCreateState((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">摘要</span>
            <input value={createState.summary} onChange={(event) => setCreateState((prev) => ({ ...prev, summary: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">文件地址</span>
            <input value={createState.fileUrl} onChange={(event) => setCreateState((prev) => ({ ...prev, fileUrl: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">预览地址</span>
            <input value={createState.previewUrl} onChange={(event) => setCreateState((prev) => ({ ...prev, previewUrl: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
          </label>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={createState.paidOnly} onChange={(event) => setCreateState((prev) => ({ ...prev, paidOnly: event.target.checked }))} />
          只给付费追踪看
        </label>
        <div className="mt-4">
          <button type="button" onClick={createAsset} disabled={loadingKey === "create"} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loadingKey === "create" ? "我在建素材..." : "新增素材"}
          </button>
        </div>
      </section>

      <div className="space-y-5">
        {items.map((item) => (
          <AssetEditor key={item.id} item={item} loadingKey={loadingKey} onSave={updateAsset} onDelete={deleteAsset} />
        ))}
      </div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </div>
  );
}

function AssetEditor({ item, loadingKey, onSave, onDelete }: { item: SkillAsset; loadingKey: string | null; onSave: (id: number, payload: Omit<SkillAsset, "id">) => Promise<void>; onDelete: (id: number) => Promise<void>; }) {
  const [form, setForm] = useState<Omit<SkillAsset, "id">>({
    subject: item.subject,
    module: item.module,
    tag: item.tag,
    difficulty: item.difficulty,
    assetType: item.assetType,
    title: item.title,
    summary: item.summary,
    fileUrl: item.fileUrl,
    previewUrl: item.previewUrl,
    useStage: item.useStage,
    paidOnly: item.paidOnly
  });

  return (
    <article className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">科目</span>
          <select value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value as Subject }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent">
            {SUBJECT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">模块</span>
          <input value={form.module} onChange={(event) => setForm((prev) => ({ ...prev, module: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">标签</span>
          <input value={form.tag} onChange={(event) => setForm((prev) => ({ ...prev, tag: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">标题</span>
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">难度</span>
          <input value={form.difficulty} onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">素材类型</span>
          <input value={form.assetType} onChange={(event) => setForm((prev) => ({ ...prev, assetType: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">摘要</span>
          <input value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">使用阶段</span>
          <input value={form.useStage} onChange={(event) => setForm((prev) => ({ ...prev, useStage: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">文件地址</span>
          <input value={form.fileUrl} onChange={(event) => setForm((prev) => ({ ...prev, fileUrl: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">预览地址</span>
          <input value={form.previewUrl} onChange={(event) => setForm((prev) => ({ ...prev, previewUrl: event.target.value }))} className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 text-sm outline-none focus:border-accent" />
        </label>
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={form.paidOnly} onChange={(event) => setForm((prev) => ({ ...prev, paidOnly: event.target.checked }))} />
        只给付费追踪看
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => onSave(item.id, form)} disabled={loadingKey === `update-${item.id}`} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">保存素材</button>
        <button type="button" onClick={() => onDelete(item.id)} disabled={loadingKey === `delete-${item.id}`} className="rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose disabled:opacity-60">删除素材</button>
      </div>
    </article>
  );
}
