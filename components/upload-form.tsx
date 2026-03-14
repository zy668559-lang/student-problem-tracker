"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUBJECT_MODULES } from "@/lib/mock-data";
import type { Subject } from "@/lib/types";

export function UploadForm() {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject>("math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modules = SUBJECT_MODULES[subject];

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData
    });

    const result = (await response.json()) as {
      ok: boolean;
      diagnosisId?: number;
      message?: string;
    };

    if (!response.ok || !result.ok || !result.diagnosisId) {
      setError(result.message ?? "上传失败");
      setLoading(false);
      return;
    }

    router.push(`/diagnosis/${result.diagnosisId}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
          <span className="block text-sm font-semibold text-ink">上传题图 / 作业图 / 试卷图</span>
          <span className="mt-1 block text-sm text-slate">支持本地图片文件，保存到 <code>uploads/</code> 目录。</span>
          <input
            name="file"
            type="file"
            accept="image/*"
            required
            className="mt-5 block w-full rounded-2xl border border-dashed border-line bg-mist/50 px-4 py-8 text-sm text-slate file:mr-4 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </label>

        <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">科目</span>
              <select
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value as Subject)}
                className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
              >
                <option value="math">数学</option>
                <option value="english">英语</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">模块</span>
              <select
                key={subject}
                name="module"
                defaultValue={modules[0]}
                className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
              >
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">分数备注</span>
              <input
                name="scoreNote"
                placeholder="例如 83 / 100"
                className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">资料类型</span>
              <select
                name="uploadType"
                defaultValue="试卷图"
                className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
              >
                <option value="题图">题图</option>
                <option value="作业图">作业图</option>
                <option value="试卷图">试卷图</option>
              </select>
            </label>
          </div>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-ink">备注</span>
            <input
              name="note"
              placeholder="例如：周末小测 / 错题回炉"
              className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
            />
          </label>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-ink">学生自述：我哪里不会</span>
            <textarea
              name="studentSelfReport"
              rows={5}
              placeholder="例如：函数图像一换条件就不会，英语阅读定位后还是选错。"
              className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
            />
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-rose">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-dashed border-line bg-white/70 p-5">
        <p className="text-sm text-slate">上传后将自动生成诊断 JSON、修复动作和本周周总结。</p>
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "分析中..." : "上传并生成诊断"}
        </button>
      </div>
    </form>
  );
}
