"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { STUCK_POINT_OPTIONS, SUBJECT_MODULES } from "@/lib/mock-data";
import { softenUploadError } from "@/lib/services/tone-chen";
import type { Subject, TrialAccessSnapshot } from "@/lib/types";

export function UploadForm({ access }: { access: TrialAccessSnapshot }) {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject>(access.subjectOpenMap.math ? "math" : "english");
  const [stuckPoint, setStuckPoint] = useState<string>("");
  const [stepsText, setStepsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modules = SUBJECT_MODULES[subject];
  const recommendedMode = useMemo(() => {
    if (!stepsText.trim() && !stuckPoint) return "quick";
    if (stepsText.trim()) return "deep";
    return "standard";
  }, [stepsText, stuckPoint]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("stuckPointChoice", stuckPoint);
    formData.set("stepsText", stepsText);

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
      setError(softenUploadError(result.message));
      setLoading(false);
      return;
    }

    router.push(`/diagnosis/${result.diagnosisId}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
          <label className="block">
            <span className="block text-sm font-semibold text-ink">先传题图 / 作业图 / 试卷图</span>
            <span className="mt-1 block text-sm text-slate">这次先传 1 张就够了，我先抓最主要的卡点。</span>
            <input
              name="file"
              type="file"
              accept="image/*"
              required
              className="mt-5 block w-full rounded-2xl border border-dashed border-line bg-mist/50 px-4 py-8 text-sm text-slate file:mr-4 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          <div className="mt-6 rounded-3xl border border-line bg-mist/40 p-4">
            <p className="text-sm font-semibold text-ink">卡点轻自评</p>
            <p className="mt-2 text-sm leading-6 text-slate">不选也能继续，我先帮你判断。</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {STUCK_POINT_OPTIONS.map((option) => {
                const active = stuckPoint === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStuckPoint(active ? "" : option)}
                    className={`rounded-full px-4 py-2 text-sm transition ${active ? "bg-ink text-white" : "border border-line bg-white text-slate"}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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
                {access.subjectOpenMap.math ? <option value="math">数学</option> : null}
                {access.subjectOpenMap.english ? <option value="english">英语</option> : null}
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
                  <option key={module} value={module}>{module}</option>
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
              rows={4}
              placeholder="例如：函数图像一换条件就不会，英语阅读定位后还是选错。"
              className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
            />
          </label>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-ink">如果孩子写过步骤，也可以顺手贴一下</span>
            <textarea
              value={stepsText}
              onChange={(event) => setStepsText(event.target.value)}
              rows={5}
              placeholder="不写也行。我能先看图，但如果有步骤，我会判断得更准一点。"
              className="w-full rounded-2xl border border-line bg-mist/70 px-4 py-3 outline-none transition focus:border-accent"
            />
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-rose">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-dashed border-line bg-white/70 p-5">
        <div className="space-y-1 text-sm text-slate">
          <p>这次会按 <span className="font-semibold text-ink">{recommendedMode}</span> 模式判断：没步骤没卡点走 quick，有卡点走 standard，有步骤再叠历史记忆走 deep。</p>
          <p>结果出来后，我会直接告诉你：这次更像卡在哪、这周先改哪一步、先看哪个素材。</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "我在帮你拆卡点..." : "上传并生成诊断"}
        </button>
      </div>
    </form>
  );
}
