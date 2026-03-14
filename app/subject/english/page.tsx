export const dynamic = "force-dynamic";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { ENGLISH_BACKEND_TAGS } from "@/lib/mock-data";
import { getSubjectSnapshot } from "@/lib/db";

export default function EnglishSubjectPage() {
  const snapshot = getSubjectSnapshot("english");

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">English Module</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">英语模块</h1>
        <p className="mt-3 text-sm leading-7 text-slate">当前阶段：{snapshot.currentStage}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {snapshot.modules.map((module) => (
            <Badge key={module} tone="gold">{module}</Badge>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="本周问题" subtitle="前台只展示 3 个核心英语模块。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyProblems.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="本周修复动作" subtitle="保持任务少而稳定。">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {snapshot.weeklyActions.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="后台诊断标签支持" subtitle="固定支持以下英语标签。">
          <div className="flex flex-wrap gap-3">
            {ENGLISH_BACKEND_TAGS.map((item) => (
              <Badge key={item} tone="ink">{item}</Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="重复错因与最近变化" subtitle="用于判断是否真正稳住。">
          <div className="space-y-4 text-sm leading-6 text-slate">
            <div>
              <p className="mb-3 font-semibold text-ink">重复错因</p>
              <div className="flex flex-wrap gap-3">
                {snapshot.repeatedTags.map((item) => (
                  <Badge key={item} tone="rose">{item}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 font-semibold text-ink">最近变化</p>
              <ul className="space-y-3">
                {snapshot.recentChanges.map((item) => (
                  <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>

      <Link href="/upload" className="inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
        上传新的英语资料
      </Link>
    </div>
  );
}

