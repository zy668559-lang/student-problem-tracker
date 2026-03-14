export const dynamic = "force-dynamic";

import { ReviewQueueItemCard } from "@/components/review-queue-item";
import { SectionCard } from "@/components/section-card";
import { getReviewQueue } from "@/lib/db";

export default function ReviewQueuePage() {
  const queue = getReviewQueue();

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-white/70 bg-white/90 p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent/70">Review Queue</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">审核台</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
          这里展示 AI 自动生成的诊断 JSON。支持通过、修改、驳回；通过后自动写入正式档案状态并刷新周总结。
        </p>
      </section>

      <SectionCard title="待审核与历史记录" subtitle="按待审核优先排序。">
        <div className="space-y-6">
          {queue.map((item) => (
            <ReviewQueueItemCard key={item.id} item={item} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

