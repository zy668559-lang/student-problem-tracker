export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { UploadForm } from "@/components/upload-form";
import { getRecheckTaskPageDetail } from "@/lib/db/p25";
import { getTrialAccessSnapshot } from "@/lib/db/product";
import { getActiveStudentId, getServerSession } from "@/lib/session";

function statusCopy(status: string) {
  switch (status) {
    case "stabilized":
      return "这条老师这边已经记成已稳住了，如果还想保险一点，也可以再传一张同类题复看。";
    case "passed_once":
      return "这条看起来有起色了，但还没稳，这轮最好别跳过。";
    case "recheck_due":
      return "这条这周必须再检，不然最容易旧问题又回来。";
    default:
      return "这条我先给你挂着复检，顺着这条线看最省力。";
  }
}

export default async function RecheckTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const access = getTrialAccessSnapshot(studentId);
  const task = getRecheckTaskPageDetail(Number(id), studentId);

  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Recheck</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{task.studentName} 的复检任务</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">{statusCopy(task.status)}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="上次问题摘要" subtitle="先把上次到底卡哪说清楚">
          <p className="text-base leading-8 text-ink">{task.lastProblemSummary}</p>
        </SectionCard>
        <SectionCard title="这次复检目标" subtitle="这轮不是重做所有题，只盯一个点">
          <p className="text-base leading-8 text-ink">{task.currentGoal}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="建议上传什么" subtitle="越贴近上次卡点，越容易看出有没有真稳住">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <p>{task.uploadHint}</p>
            <p>这次建议优先传：同类题回做图、关键步骤图，或者孩子重新写一遍的过程图。</p>
            <p>如果孩子这次还是说不清卡哪，也没关系，先传图，我继续帮你判断。</p>
          </div>
        </SectionCard>
        <SectionCard title="结果对比入口" subtitle="做完之后，直接回头对比上次">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <Link href={task.compareDiagnosisId ? `/diagnosis/${task.compareDiagnosisId}` : "/dashboard"} className="block rounded-2xl border border-line bg-white px-4 py-3 text-ink">
              看上次诊断
            </Link>
            <Link href={task.compareWeeklyReportId ? `/weekly-report/${task.compareWeeklyReportId}` : "/dashboard"} className="block rounded-2xl border border-line bg-white px-4 py-3 text-ink">
              看当前周总结
            </Link>
            <p className="rounded-2xl bg-mist px-4 py-3 text-ink">这轮学生先做：{task.studentTodayAction}</p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="复检上传入口" subtitle="这次会按复检任务单独记账，不会混进普通体检上传。">
        <UploadForm
          access={access}
          submissionType="recheck"
          recheckTaskId={task.id}
          initialSubject={task.subject}
          initialModule={task.module}
          lockSubject
          lockModule
          heading="复检上传"
          subtitle="这次是顺着上次问题继续看，所以我会把它和原来的复检任务串起来。"
          submitLabel="提交复检并生成对比"
          openEventName="opened_recheck_task"
          completeEventName="complete_recheck_upload"
          trackingDiagnosisId={task.latestDiagnosisId}
          defaultNote={`复检目标：${task.tag}`}
          defaultSelfReport={`这次就盯 ${task.tag}，看看是不是比上次稳一点。`}
          uploadHint={task.uploadHint}
          notePlaceholder="例如：这次是按老师说的步骤重做一遍"
          selfReportPlaceholder="例如：这次我主要想看，前面会不会，最后一步还会不会掉。"
        />
      </SectionCard>
    </div>
  );
}
