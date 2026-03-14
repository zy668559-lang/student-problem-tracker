import { SectionCard } from "@/components/section-card";
import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Upload</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">上传学生问题素材</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
          这里不是题库，而是本周问题诊断入口。每次上传都会生成结构化诊断 JSON、修复动作和周总结更新。
        </p>
      </section>

      <SectionCard title="上传表单" subtitle="支持数学和英语，先跑通本地 MVP 闭环。">
        <UploadForm />
      </SectionCard>
    </div>
  );
}
