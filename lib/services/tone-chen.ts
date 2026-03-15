import type { DiagnosisPayload, MemorySummary, WeeklyReportPayload } from "@/lib/types";

function normalizeSentence(value: string) {
  return value.replace(/\s+/g, " ").replace(/[。！!？?]+$/g, "").trim();
}

function withPrefix(prefix: string, value: string) {
  const text = normalizeSentence(value);
  if (!text) {
    return `${prefix}先空着，我后面再补。`;
  }
  if (text.startsWith(prefix)) {
    return `${text}。`;
  }
  return `${prefix}${text}。`;
}

function rewriteList(items: string[], prefix: string, fallback: string) {
  const normalized = items.map((item) => normalizeSentence(item)).filter(Boolean);
  const source = normalized.length > 0 ? normalized : [fallback];
  return source.map((item, index) => withPrefix(`${prefix}${index + 1}：`, item));
}

export function rewriteDiagnosisForChenTeacher(payload: DiagnosisPayload): DiagnosisPayload {
  return {
    ...payload,
    current_stage: withPrefix("现在先别急着往后赶，孩子眼下更像卡在：", payload.current_stage),
    repair_actions: rewriteList(payload.repair_actions, "这周先改", "先把最容易掉链子的那一步稳住"),
    parent_summary: withPrefix("家长这周先这么看：", payload.parent_summary),
    problem_tags: payload.problem_tags.map((item) => normalizeSentence(item)).filter(Boolean)
  };
}

export function rewriteWeeklyReportForChenTeacher(payload: WeeklyReportPayload): WeeklyReportPayload {
  return {
    ...payload,
    this_week_problem: rewriteList(payload.this_week_problem, "这周主要问题", "先等第一条诊断出来"),
    this_week_actions: rewriteList(payload.this_week_actions, "接下来先做", "先上传一条我来帮你拆动作"),
    improved_points: rewriteList(payload.improved_points, "已经稳住的地方", "先从一个小点稳住开始"),
    unstable_points: rewriteList(payload.unstable_points, "还没完全稳住", "这周先别贪多，先守住一个点"),
    repeated_error_tags: rewriteList(payload.repeated_error_tags, "反复冒出来的错因", "先观察本周高频卡点"),
    next_week_plan: rewriteList(payload.next_week_plan, "下周重点就盯", "先把重复错因压下来"),
    recheck_status: payload.recheck_status ? withPrefix("复检状态：", payload.recheck_status) : undefined,
    next_priority: payload.next_priority ? withPrefix("下轮优先级：", payload.next_priority) : undefined,
    continue_tracking_reason: payload.continue_tracking_reason ? withPrefix("继续追踪的理由：", payload.continue_tracking_reason) : undefined,
    student_today_action: payload.student_today_action ? withPrefix("今天先做：", payload.student_today_action) : undefined,
    student_minimum_action: payload.student_minimum_action ? withPrefix("再练 1 个最小动作：", payload.student_minimum_action) : undefined,
    student_self_check: payload.student_self_check ? withPrefix("做完这样自检：", payload.student_self_check) : undefined,
    parent_weekly_summary: payload.parent_weekly_summary ? withPrefix("家长版一口气看懂：", payload.parent_weekly_summary) : undefined,
    student_weekly_summary: payload.student_weekly_summary ? withPrefix("学生版这周就这么干：", payload.student_weekly_summary) : undefined,
    continue_tracking_label: payload.continue_tracking_label ? withPrefix("是否建议继续追踪：", payload.continue_tracking_label) : undefined
  };
}

export function rewriteMemorySummaryForChenTeacher(payload: MemorySummary): MemorySummary {
  return {
    stable_tags: rewriteList(payload.stable_tags, "目前相对稳一点的是", "还在积累稳定标签"),
    repeated_error_tags: rewriteList(payload.repeated_error_tags, "反复回来的还是", "先继续观察重复错因"),
    last_3_weeks_focus: rewriteList(payload.last_3_weeks_focus, "最近三周一直在盯", "先把本周重点跑一遍"),
    last_best_improvement: withPrefix("最近一次最像样的进步是：", payload.last_best_improvement),
    next_priority: withPrefix("下一步最该先抓：", payload.next_priority),
    next_recheck_reason: withPrefix("这轮为什么还得复检：", payload.next_recheck_reason),
    next_action_type: withPrefix("下一步动作类型：", payload.next_action_type),
    recheck_status_summary: withPrefix("复检状态小结：", payload.recheck_status_summary),
    last_recheck_at: payload.last_recheck_at,
    preferred_tone: payload.preferred_tone || "陈老师口语化",
    updated_at: payload.updated_at
  };
}

export function softenUploadError(message?: string) {
  if (!message) {
    return "这次先别急，我看还差一张题图，补上我就能继续帮你判断。";
  }
  if (message.includes("图片") || message.includes("file")) {
    return "先随手传一张就行，我先帮你看看卡点大概落在哪。";
  }
  return message;
}
