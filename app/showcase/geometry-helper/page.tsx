"use client";

import { useState } from "react";

const helperLines = [
  {
    id: "median",
    label: "连到中点",
    hint: "这条线能把已知连到要证。"
  },
  {
    id: "angle",
    label: "角里分一分",
    hint: "这条线会绕远，连不到关键点。"
  },
  {
    id: "parallel",
    label: "画条平行",
    hint: "这条线看着顺，但用不上。"
  }
] as const;

export default function GeometryHelperLinePage() {
  const [activeLine, setActiveLine] = useState<(typeof helperLines)[number]["id"] | null>(null);
  const [showHint, setShowHint] = useState(false);

  const activeHint = helperLines.find((line) => line.id === activeLine)?.hint;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
          <h1 className="text-2xl font-semibold text-ink">不知道该画哪条线</h1>
          <p className="mt-2 text-base text-slate">先看已知和目标，再决定出哪条线</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">主画布</span>
              <div className="flex flex-wrap gap-2">
                {helperLines.map((line) => (
                  <button
                    key={line.id}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      activeLine === line.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate"
                    }`}
                    onClick={() => {
                      setActiveLine(line.id);
                      setShowHint(true);
                    }}
                    type="button"
                  >
                    {line.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="aspect-[4/3] w-full">
                <svg viewBox="0 0 420 280" className="h-full w-full">
                  <rect x="20" y="20" width="380" height="240" rx="20" fill="#ffffff" />
                  <polygon
                    points="110,220 310,220 210,80"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="3"
                  />
                  <circle cx="110" cy="220" r="6" fill="#0f172a" />
                  <circle cx="310" cy="220" r="6" fill="#0f172a" />
                  <circle cx="210" cy="80" r="6" fill="#0f172a" />
                  <text x="90" y="240" fontSize="12" fill="#334155">A</text>
                  <text x="318" y="240" fontSize="12" fill="#334155">B</text>
                  <text x="215" y="72" fontSize="12" fill="#334155">C</text>

                  {activeLine === "median" ? (
                    <line x1="210" y1="80" x2="210" y2="220" stroke="#10b981" strokeWidth="3" />
                  ) : null}
                  {activeLine === "angle" ? (
                    <line x1="210" y1="80" x2="140" y2="210" stroke="#f97316" strokeWidth="3" />
                  ) : null}
                  {activeLine === "parallel" ? (
                    <line x1="150" y1="180" x2="340" y2="180" stroke="#f43f5e" strokeWidth="3" />
                  ) : null}
                </svg>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate">
              当前：{activeLine ? helperLines.find((line) => line.id === activeLine)?.label : "还没选线"}
            </p>
            {showHint && activeHint ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">{activeHint}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm"
                onClick={() => {
                  setActiveLine("median");
                  setShowHint(true);
                }}
                type="button"
              >
                看正确那条线
              </button>
              <button
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate"
                onClick={() => {
                  setActiveLine(null);
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
                <p>现在不是不会证，是不知道该画哪条线。</p>
                <p>他会乱画线，但不知道哪条线有用。</p>
                <p>这周先盯：先看已知和目标，再出线。</p>
              </div>
            </section>

            <section className="rounded-panel border border-amber-200 bg-amber-50/80 p-4 shadow-panel">
              <h3 className="text-xs font-semibold uppercase text-amber-800">口播提示</h3>
              <div className="mt-2 space-y-1 text-xs text-amber-900">
                <p>他不是不会画，是不知道哪条线有用。</p>
                <p>我点这条线，你看已知就能连到要证。</p>
                <p>本周就练一个动作：先看已知和目标，再出线。</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
