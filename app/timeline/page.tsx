export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { getEvidenceTimelineDetail } from "@/lib/db/a4";
import { getActiveStudentId, getServerSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";

function nodeTone(kind: string) {
  switch (kind) {
    case "weekly_report":
      return "accent" as const;
    case "change_log":
      return "gold" as const;
    case "recheck_task":
      return "rose" as const;
    default:
      return "ink" as const;
  }
}

function nodeLabel(kind: string) {
  switch (kind) {
    case "upload":
      return "上传";
    case "diagnosis":
      return "诊断";
    case "recheck_task":
      return "复检";
    case "weekly_report":
      return "周报";
    case "change_log":
      return "变化";
    case "result_event":
      return "行为";
    case "memory":
      return "记忆";
    default:
      return "证据";
  }
}

export default async function TimelinePage() {
  const session = await getServerSession();
  const studentId = getActiveStudentId(session);
  const detail = getEvidenceTimelineDetail(studentId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Timeline</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{detail.studentName} 的证据时间轴</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">这一页不是看一条诊断对不对，而是把上周到这周的证据串起来，让你一眼看懂：问题有没有变、动作有没有落、哪块是真稳了、哪块还得继续盯。</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="上次主要问题" subtitle="先把起点说清楚，不然变化没法看">
          <p className="text-base leading-8 text-ink">{detail.lastProblemSummary}</p>
        </SectionCard>
        <SectionCard title="本次主要变化" subtitle="这周到底往前走了没有">
          <p className="text-base leading-8 text-ink">{detail.currentChangeSummary}</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="已稳住" subtitle="这几条这周可以先放心一点">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.stabilizedItems.length > 0 ? detail.stabilizedItems.map((item) => (
              <li key={item} className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-ink">{item}</li>
            )) : <li className="rounded-2xl border border-line px-4 py-3">这周先别急着记稳，我还想再看一轮。</li>}
          </ul>
        </SectionCard>
        <SectionCard title="还没稳住" subtitle="这几条这周先别松手">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.unstableItems.length > 0 ? detail.unstableItems.map((item) => (
              <li key={item} className="rounded-2xl border border-line px-4 py-3">{item}</li>
            )) : <li className="rounded-2xl border border-line px-4 py-3">这周暂时没有新的未稳项。</li>}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="下轮优先级" subtitle="下一轮先盯谁">
          <p className="text-base leading-8 text-ink">{detail.nextPriority}</p>
        </SectionCard>
        <SectionCard title="建议继续追踪理由" subtitle="为什么不建议看到这就停">
          <p className="text-base leading-8 text-ink">{detail.continueTrackingReason}</p>
        </SectionCard>
        <SectionCard title="最近家长动作" subtitle="结果页上这几步，也能看出意愿变化">
          <ul className="space-y-3 text-sm leading-6 text-slate">
            {detail.recentEventSummary.length > 0 ? detail.recentEventSummary.map((item) => (
              <li key={item} className="rounded-2xl bg-mist px-4 py-3 text-ink">{item}</li>
            )) : <li className="rounded-2xl border border-line px-4 py-3">这周还没有新的结果页动作。</li>}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="证据时间轴" subtitle="每个节点都只回答四件事：当时卡哪、当时做了什么、当时结果如何、对下一次有什么影响">
        <div className="space-y-4">
          {detail.nodes.map((node, index) => (
            <div key={node.id} data-testid={`timeline-node-${node.id}`} className="grid gap-4 rounded-3xl border border-line bg-white px-5 py-5 lg:grid-cols-[56px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-sm font-semibold text-ink">{index + 1}</div>
                {index < detail.nodes.length - 1 ? <div className="h-full w-px bg-line" /> : null}
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone={nodeTone(node.kind)}>{nodeLabel(node.kind)}</Badge>
                      <p className="text-lg font-semibold text-ink">{node.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate">{node.subtitle} · {formatDate(node.createdAt)}</p>
                  </div>
                  {node.href ? <Link href={node.href} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink">看当时详情</Link> : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当时卡点</p>
                    <p className="mt-2 text-sm leading-7 text-ink">{node.problem}</p>
                  </div>
                  <div className="rounded-2xl border border-line px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当时动作</p>
                    <p className="mt-2 text-sm leading-7 text-ink">{node.action}</p>
                  </div>
                  <div className="rounded-2xl border border-line px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">当时结果</p>
                    <p className="mt-2 text-sm leading-7 text-ink">{node.result}</p>
                  </div>
                  <div className="rounded-2xl border border-line px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">对下一次的影响</p>
                    <p className="mt-2 text-sm leading-7 text-ink">{node.nextImpact}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <section className="rounded-panel border border-accent/20 bg-accent/10 p-6 shadow-panel sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">CTA</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">继续追踪 4 周</h2>
            <p className="mt-3 text-sm leading-7 text-slate">如果你想看的不是“这道题今天对没对”，而是“这类问题到底稳没稳”，那就顺着这条时间轴继续追 4 周。这样每次变化都有证据，不会只凭感觉判断。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={detail.priorityRecheckTaskId ? `/recheck/${detail.priorityRecheckTaskId}` : "/upload"} className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">继续追踪 4 周</Link>
            <Link href={detail.latestWeeklyReportId ? `/weekly-report/${detail.latestWeeklyReportId}` : "/dashboard"} className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink">回看这周周报</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
