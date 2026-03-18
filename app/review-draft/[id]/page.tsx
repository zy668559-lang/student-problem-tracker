export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getReviewDraftDetail } from "@/lib/db/d1";
import { getServerSession } from "@/lib/session";
import { formatDate, reviewStatusLabel, subjectLabel } from "@/lib/utils";

export default async function ReviewDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = getReviewDraftDetail(Number(id));
  const session = await getServerSession();

  if (!draft) notFound();
  if (!session) notFound();
  if (session.role !== "admin" && session.role !== "reviewer" && !session.studentIds.includes(draft.studentId)) {
    notFound();
  }

  const primaryActionHref = draft.officialDiagnosisId ? `/diagnosis/${draft.officialDiagnosisId}` : "/dashboard";
  const primaryActionLabel = draft.officialDiagnosisId ? "查看正式诊断" : "先回首页等审核";

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Draft Review</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">这次上传已经收到了</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
              这条先进入待审核队列。老师确认前，它不会直接写进正式学生档案。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone={draft.reviewStatus === "approved" ? "accent" : draft.reviewStatus === "rejected" ? "rose" : "gold"}>
              {reviewStatusLabel(draft.reviewStatus)}
            </Badge>
            <Badge tone="ink">{subjectLabel(draft.subject)} / {draft.module}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="当前状态" subtitle="先看这条走到哪一步了">
          <p className="text-base leading-8 text-ink">
            {draft.reviewStatus === "approved"
              ? "这条已经审核通过，正式学生档案已经生成。"
              : draft.reviewStatus === "rejected"
                ? "这条草稿这次先没入库，后面会按新上传重新判断。"
                : draft.reviewStatus === "edited"
                  ? "老师已经改过草稿，但还没正式确认入库。"
                  : "现在是自动抓取草稿，正在等老师确认。"}
          </p>
        </SectionCard>
        <SectionCard title="这次先看出来什么" subtitle="这是自动抓取的初判，不是最终归档版">
          <p className="text-base leading-8 text-ink">{draft.payload.current_stage}</p>
        </SectionCard>
        <SectionCard title="时间" subtitle="看一下这条是什么时候进队列的">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <p>进入队列：{formatDate(draft.createdAt)}</p>
            <p>最近更新：{formatDate(draft.updatedAt)}</p>
            {draft.materializedAt ? <p>正式入库：{formatDate(draft.materializedAt)}</p> : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="上传信息" subtitle="这次先按这些线索抓草稿">
          <div className="space-y-3 text-sm leading-6 text-slate">
            <p><span className="font-semibold text-ink">学生：</span>{draft.studentName}</p>
            <p><span className="font-semibold text-ink">资料类型：</span>{draft.uploadType}</p>
            <p><span className="font-semibold text-ink">文件：</span>{draft.fileName}</p>
            <p><span className="font-semibold text-ink">分数备注：</span>{draft.scoreNote ?? "这次没填也没关系。"}</p>
            <p><span className="font-semibold text-ink">学生描述：</span>{draft.studentSelfReport ?? "这次没写，我先按题图判断了。"}</p>
            <p><span className="font-semibold text-ink">卡点自评：</span>{draft.stuckPointChoice ?? "这次没选，我先自动抓。"}</p>
          </div>
        </SectionCard>
        <SectionCard title="家长现在最该知道什么" subtitle="正式入档前，先知道这条为什么还要等一下">
          <div className="space-y-4 text-sm leading-7 text-slate">
            <p>现在看到的是自动抓取草稿。它会先进审核台，避免系统把还没过老师眼的内容直接塞进正式学生档案。</p>
            <p>如果老师确认通过，这条会自动生成正式诊断、正式动作和正式每周总结。</p>
            {draft.reviewNotes ? <p className="rounded-2xl bg-mist px-4 py-3 text-ink">审核备注：{draft.reviewNotes}</p> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="自动抓取草稿" subtitle="这里保留初判 JSON，方便审核时对照">
        <pre className="overflow-x-auto rounded-3xl bg-[#0f172a] p-5 text-sm leading-7 text-slate-100">{JSON.stringify(draft.payload, null, 2)}</pre>
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link href={primaryActionHref} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">{primaryActionLabel}</Link>
        {(session.role === "admin" || session.role === "reviewer") ? (
          <Link href="/review-queue" className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">去审核台</Link>
        ) : (
          <Link href="/upload" className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">继续上传</Link>
        )}
      </div>
    </div>
  );
}

