import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { UploadForm } from "@/components/upload-form";
import { getPriorityRecheckTask } from "@/lib/db/p25";
import { getTrialAccessSnapshot } from "@/lib/db/product";
import { getActiveStudentId, getServerSession } from "@/lib/session";

export default async function UploadPage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const access = getTrialAccessSnapshot(studentId);
  const priorityRecheck = getPriorityRecheckTask(studentId);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Upload</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">上传学生问题素材</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
          这里不是题库，是这周问题入口。你先传一张，我先帮你看孩子更像卡在哪、这周先改哪一步。
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate">
          <span className="rounded-full bg-mist px-4 py-2">当前孩子：{access.studentName ?? "未命名学生"}</span>
          <span className="rounded-full bg-mist px-4 py-2">剩余试用：{access.freeTrialRemaining} / {access.freeTrialTotal}</span>
          <span className="rounded-full bg-mist px-4 py-2">单次最多：{access.maxImagesPerUpload} 张</span>
          <span className="rounded-full bg-mist px-4 py-2">当前开放：{access.enabledSubjects.map((item) => item === "math" ? "数学" : "英语").join(" / ")}</span>
        </div>
      </section>

      {priorityRecheck ? (
        <section className="rounded-panel border border-accent/20 bg-accent/10 p-5 shadow-panel">
          <p className="text-sm font-semibold text-ink">这位孩子现在有一条更该先做的复检</p>
          <p className="mt-2 text-sm leading-6 text-slate">先盯 {priorityRecheck.tag}。如果你这次传的是回做图，直接走复检入口会更顺，前后也更容易对比。</p>
          <Link href={`/recheck/${priorityRecheck.id}`} className="mt-4 inline-flex rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white">
            去复检这条任务
          </Link>
        </section>
      ) : null}

      <SectionCard title="普通体检上传" subtitle="先把题图、卡点自评和简单步骤放进来，我再帮你往下拆。">
        <UploadForm access={access} />
      </SectionCard>
    </div>
  );
}
