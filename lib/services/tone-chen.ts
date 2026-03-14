import type { DiagnosisPayload, MemorySummary, WeeklyReportPayload } from "@/lib/types";

function normalizeSentence(value: string) {
  return value.replace(/\s+/g, " ").replace(/[。！!？?]+$/g, "").trim();
}

function withPrefix(prefix: string, value: string) {
  const text = normalizeSentence(value);
  if (!text) {
    return prefix;
  }
  if (text.startsWith(prefix)) {
    return `${text}。`;
  }
  return `${prefix}${text}。`;
}

function rewriteList(items: string[], prefix: string) {
  return items.map((item, index) => withPrefix(`${prefix}${index + 1}：`, item));
}

export function rewriteDiagnosisForChenTeacher(payload: DiagnosisPayload): DiagnosisPayload {
  const stage = withPrefix("现在先别急着往后赶，孩子眼下卡在：", payload.current_stage);
  const actions = rewriteList(payload.repair_actions, "这周先做");
  const summary = withPrefix("家长这周先这么看：", payload.parent_summary);

  return {
    ...payload,
    current_stage: stage,
    repair_actions: actions,
    parent_summary: summary,
    problem_tags: payload.problem_tags.map((item) => normalizeSentence(item)).filter(Boolean)
  };
}

export function rewriteWeeklyReportForChenTeacher(payload: WeeklyReportPayload): WeeklyReportPayload {
  return {
    this_week_problem: rewriteList(payload.this_week_problem, "这周主要问题"),
    this_week_actions: rewriteList(payload.this_week_actions, "接下来先做"),
    improved_points: rewriteList(payload.improved_points, "已经稳住的地方"),
    unstable_points: rewriteList(payload.unstable_points, "还没完全稳住"),
    repeated_error_tags: rewriteList(payload.repeated_error_tags, "反复冒出来的错因"),
    next_week_plan: rewriteList(payload.next_week_plan, "下周重点就盯"),
  };
}

export function rewriteMemorySummaryForChenTeacher(payload: MemorySummary): MemorySummary {
  return {
    stable_tags: rewriteList(payload.stable_tags, "目前相对稳一点的是"),
    repeated_error_tags: rewriteList(payload.repeated_error_tags, "反复回来的还是"),
    last_3_weeks_focus: rewriteList(payload.last_3_weeks_focus, "最近三周一直在盯"),
    next_priority: withPrefix("下一步最该先抓：", payload.next_priority)
  };
}
