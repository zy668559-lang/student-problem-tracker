import { SectionCard } from "@/components/section-card";
import { UploadForm } from "@/components/upload-form";
import { getTrialAccessSnapshot } from "@/lib/db/product";

export default function UploadPage() {
  const access = getTrialAccessSnapshot();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Upload</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">上传学生问题素材</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
          这里不是题库，是本周问题入口。你先传一张，我先帮你看孩子更像卡在哪、这周先改哪一步。
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate">
          <span className="rounded-full bg-mist px-4 py-2">剩余试用：{access.freeTrialRemaining} / {access.freeTrialTotal}</span>
          <span className="rounded-full bg-mist px-4 py-2">单次最多：{access.maxImagesPerUpload} 张</span>
          <span className="rounded-full bg-mist px-4 py-2">当前开放：{access.enabledSubjects.map((item) => item === "math" ? "数学" : "英语").join(" / ")}</span>
        </div>
      </section>

      <SectionCard title="上传表单" subtitle="先把图、卡点自评和简单步骤放进来，我再帮你往下拆。">
        <UploadForm access={access} />
      </SectionCard>
    </div>
  );
}
