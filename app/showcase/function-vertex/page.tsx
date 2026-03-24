"use client";

import { useMemo, useState } from "react";

const vertexPresets = [
  { label: "左上", x: -2, y: 2 },
  { label: "右上", x: 2, y: 2 },
  { label: "左下", x: -2, y: -2 },
  { label: "右下", x: 2, y: -2 }
];

const openingPresets = [
  { label: "口朝上", value: "up" as const },
  { label: "口朝下", value: "down" as const }
];

export default function FunctionVertexShowcasePage() {
  const [vertexIndex, setVertexIndex] = useState(0);
  const [opening, setOpening] = useState<"up" | "down">("up");
  const [showHint, setShowHint] = useState(false);

  const vertex = vertexPresets[vertexIndex];
  const openingLabel = opening === "up" ? "朝上" : "朝下";

  const curvePath = useMemo(() => {
    const direction = opening === "up" ? -1 : 1;
    const y = (x: number) => direction * 0.25 * x * x;
    const points = Array.from({ length: 41 }, (_, i) => {
      const x = -4 + i * 0.2;
      return `${x * 20 + 200},${y(x) * 20 + 140}`;
    });
    return `M ${points.join(" L ")}`;
  }, [opening]);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
          <h1 className="text-2xl font-semibold text-ink">一换顶点就乱</h1>
          <p className="mt-2 text-base text-slate">先看顶点在哪，再看口往哪开</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">主画布</span>
              <div className="flex flex-wrap gap-2">
                {vertexPresets.map((preset, index) => (
                  <button
                    key={preset.label}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      index === vertexIndex
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate"
                    }`}
                    onClick={() => {
                      setVertexIndex(index);
                      setShowHint(false);
                    }}
                    type="button"
                  >
                    顶点{preset.label}
                  </button>
                ))}
                {openingPresets.map((preset) => (
                  <button
                    key={preset.value}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      preset.value === opening
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate"
                    }`}
                    onClick={() => {
                      setOpening(preset.value);
                      setShowHint(false);
                    }}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="aspect-[4/3] w-full">
                <svg viewBox="0 0 400 280" className="h-full w-full">
                  <rect x="20" y="20" width="360" height="240" rx="20" fill="#ffffff" />
                  <line x1="40" y1="140" x2="360" y2="140" stroke="#d1d5db" strokeWidth="2" />
                  <line x1="200" y1="40" x2="200" y2="240" stroke="#d1d5db" strokeWidth="2" />
                  <path d={curvePath} stroke="#10b981" strokeWidth="3" fill="none" />
                  <circle
                    cx={200 + vertex.x * 20}
                    cy={140 - vertex.y * 20}
                    r="8"
                    fill="#0f766e"
                  />
                  <text x={200 + vertex.x * 20 + 12} y={140 - vertex.y * 20 - 10} fill="#0f766e" fontSize="12">
                    顶点
                  </text>
                </svg>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate">
              当前：顶点在{vertex.label}，口{openingLabel}。
            </p>
            {showHint ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">
                一换顶点，左右上下最容易反着想。
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm"
                onClick={() => setShowHint(true)}
                type="button"
              >
                看他为什么乱
              </button>
              <button
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate"
                onClick={() => {
                  setVertexIndex(0);
                  setOpening("up");
                  setShowHint(false);
                }}
                type="button"
              >
                回到原样
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
              <h2 className="text-base font-semibold text-ink">家长一眼懂</h2>
              <div className="mt-3 space-y-2 text-sm text-slate">
                <p>现在不是不会画，是顶点一挪就乱。</p>
                <p>这周先盯两个动作：顶点在哪、口往哪开。</p>
                <p>先把左右上下分清，再做题。</p>
              </div>
            </section>

            <section className="rounded-panel border border-amber-200 bg-amber-50/80 p-4 shadow-panel">
              <h3 className="text-xs font-semibold uppercase text-amber-800">口播提示</h3>
              <div className="mt-2 space-y-1 text-xs text-amber-900">
                <p>这孩子卡的不是公式，是顶点一挪就乱。</p>
                <p>我动一下顶点，你看他左右上下就分不清。</p>
                <p>本周就盯两件事：顶点在哪、口往哪开。</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
