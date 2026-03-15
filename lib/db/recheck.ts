import { getDb, getPrimaryStudentId } from "@/lib/db";
import type {
  DiagnosisMode,
  MemorySummary,
  RecheckOutcome,
  RecheckSyncResult,
  RecheckTaskDetail,
  RecheckTaskStatus,
  Subject,
  WeeklyReportPayload
} from "@/lib/types";

interface DiagnosisContext {
  id: number;
  studentId: number;
  subject: Subject;
  module: string;
  problemTags: string[];
  repairActions: string[];
  currentStage: string;
  reviewStatus: string;
  diagnosisMode: DiagnosisMode;
  scoreNote: string | null;
  note: string | null;
  studentSelfReport: string | null;
  stepQuality: string | null;
  createdAt: string;
}

interface RecheckMemoryPatch {
  nextPriority: string;
  nextRecheckReason: string;
  nextActionType: string;
  recheckStatusSummary: string;
  lastRecheckAt: string | null;
}

interface RecheckOverlay {
  recheckStatus: string;
  nextPriority: string;
  continueTrackingReason: string;
  studentTodayAction: string;
  studentMinimumAction: string;
  studentSelfCheck: string;
  improvedPoint: string;
  unstablePoint: string;
  repeatedTag: string;
}

function parseArray(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseObject<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function uniqueStrings(items: Array<string | null | undefined>, limit: number) {
  return Array.from(new Set(items.map((item) => (item ?? "").trim()).filter(Boolean))).slice(0, limit);
}

function parseScore(scoreNote: string | null) {
  if (!scoreNote) return null;
  const match = scoreNote.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getDiagnosisContext(diagnosisId: number): DiagnosisContext | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      d.id,
      u.student_id,
      d.subject,
      d.module,
      d.problem_tags,
      d.repair_actions,
      d.current_stage,
      d.review_status,
      d.diagnosis_mode,
      d.created_at,
      u.score_note,
      u.note,
      u.student_self_report,
      u.step_quality
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE d.id = ?
    LIMIT 1
  `).get(diagnosisId) as {
    id: number;
    student_id: number;
    subject: Subject;
    module: string;
    problem_tags: string;
    repair_actions: string;
    current_stage: string;
    review_status: string;
    diagnosis_mode: DiagnosisMode | null;
    created_at: string;
    score_note: string | null;
    note: string | null;
    student_self_report: string | null;
    step_quality: string | null;
  } | undefined;

  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    subject: row.subject,
    module: row.module,
    problemTags: parseArray(row.problem_tags),
    repairActions: parseArray(row.repair_actions),
    currentStage: row.current_stage,
    reviewStatus: row.review_status,
    diagnosisMode: (row.diagnosis_mode ?? "standard") as DiagnosisMode,
    scoreNote: row.score_note,
    note: row.note,
    studentSelfReport: row.student_self_report,
    stepQuality: row.step_quality,
    createdAt: row.created_at
  };
}

function getPaidTrackingEnabled(studentId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT paid_tracking_enabled FROM trial_access WHERE student_id = ? LIMIT 1`).get(studentId) as { paid_tracking_enabled: number } | undefined;
  return Boolean(row?.paid_tracking_enabled ?? 0);
}

function getTagMetrics(studentId: number, tag: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN datetime(d.created_at) >= datetime('now', '-7 day') THEN 1 ELSE 0 END) AS repeat_count_7d,
      SUM(CASE WHEN datetime(d.created_at) >= datetime('now', '-30 day') THEN 1 ELSE 0 END) AS repeat_count_30d,
      MAX(d.created_at) AS last_seen_at
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
      AND d.review_status != 'rejected'
      AND d.problem_tags LIKE ?
  `).get(studentId, `%${tag}%`) as {
    repeat_count_7d: number | null;
    repeat_count_30d: number | null;
    last_seen_at: string | null;
  };

  return {
    repeatCount7d: Number(row.repeat_count_7d ?? 0),
    repeatCount30d: Number(row.repeat_count_30d ?? 0),
    lastSeenAt: row.last_seen_at
  };
}

function getLatestWeeklyReportSnapshot(studentId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT report_json FROM weekly_reports WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`).get(studentId) as { report_json: string } | undefined;
  return parseObject<WeeklyReportPayload | null>(row?.report_json ?? null, null);
}

function hasWeeklyCarryOver(report: WeeklyReportPayload | null, module: string, tag: string) {
  if (!report) return false;
  const pool = [
    ...(report.unstable_points ?? []),
    ...(report.repeated_error_tags ?? []),
    ...(report.next_week_plan ?? [])
  ].join(" ");
  return pool.includes(tag) || pool.includes(module) || pool.includes("没稳");
}

function pickFocusTag(context: DiagnosisContext) {
  const report = getLatestWeeklyReportSnapshot(context.studentId);
  const paidTrackingEnabled = getPaidTrackingEnabled(context.studentId);
  const ranked = context.problemTags.map((tag) => {
    const metrics = getTagMetrics(context.studentId, tag);
    const carryOver = hasWeeklyCarryOver(report, context.module, tag);
    const selfReportBonus = tag.startsWith("?????") ? 400 : 0;
    const score = metrics.repeatCount30d * 10 + metrics.repeatCount7d * 6 + (carryOver ? 8 : 0) + (paidTrackingEnabled ? 2 : 0) + selfReportBonus;
    return { tag, metrics, carryOver, score };
  }).sort((left, right) => right.score - left.score);

  const selected = ranked[0] ?? { tag: context.problemTags[0] ?? context.module, metrics: { repeatCount7d: 0, repeatCount30d: 0, lastSeenAt: context.createdAt }, carryOver: false, score: 0 };
  return { ...selected, paidTrackingEnabled };
}

function buildNextActionType(context: DiagnosisContext, tag: string) {
  const text = `${tag} ${context.currentStage}`;
  if (context.subject === "math" && text.includes("辅助线")) return "先补辅助线触发";
  if (context.subject === "math" && text.includes("函数")) return "先把函数起手步骤练顺";
  if (context.subject === "english" && text.includes("定位")) return "先做原文定位复练";
  if (text.includes("最后一步")) return "先补最后一步收尾";
  return "先做同类题再检";
}

function buildStudentSelfCheck(context: DiagnosisContext, tag: string) {
  if (context.subject === "math") {
    return `做完自己看三眼：条件有没有漏、关键步骤有没有写、最后一步有没有验算。重点盯住“${tag}”。`;
  }
  return `做完自己回头看：题干关键词有没有圈出来、原文定位有没有落准、这次“${tag}”有没有再冒出来。`;
}

function buildSummaryFromTask(task: RecheckTaskDetail) {
  if (task.stabilized) {
    return `这类题这周可以先记成已稳住：${task.tag}。先别完全松手，但不用天天盯。`;
  }
  if (task.status === "passed_once") {
    return `这类题是有进步了，但还没稳：${task.tag}。还得再过一轮，别刚好一点就松。`;
  }
  if (task.status === "improving") {
    return `这类题已经开始往上走了，但还没站稳：${task.tag}。这一轮先别换题型，继续压。`;
  }
  if (task.status === "recheck_due") {
    return `这类题这周必须回头再检：${task.tag}。不再看一轮，很容易旧问题又回来。`;
  }
  return `这类题我先给你挂上复检：${task.tag}。下一轮先回头看它，不让它悄悄反弹。`;
}

function buildContinueTrackingReason(task: RecheckTaskDetail) {
  if (task.stabilized) {
    return `这次是稳住了，但还得继续盯下一个高频点，不然整体变化接不上。`;
  }
  if (task.status === "recheck_due") {
    return `因为这类错因最近重复得很勤，或者上周明明有进步却没稳，不继续追踪基本都会回弹。`;
  }
  return `因为这类题已经有进步苗头了，但还没彻底站住，不继续追踪就容易只是假象。`;
}

function buildPriority(task: RecheckTaskDetail) {
  if (task.stabilized) {
    return `这块先记成已稳住，然后把火力转到下一个最重复的错因。`;
  }
  return `下一轮优先盯 ${task.tag}，先把这类题从“会一半”拉到“基本稳住”。`;
}

function buildTriggerReason(context: DiagnosisContext, tag: string, repeatCount30d: number, carryOver: boolean, paidTrackingEnabled: boolean) {
  if (repeatCount30d >= 2) {
    return `同一类错因“${tag}”近 30 天已经重复 ${repeatCount30d} 次，这轮直接进复检优先。`;
  }
  if (carryOver) {
    return `上周这块已经看出有进步但没稳，这周必须再检，不然容易回弹。`;
  }
  if (paidTrackingEnabled) {
    return `当前是追踪模式，诊断后默认把主卡点挂进复检，方便连续看变化。`;
  }
  return `这次先把主卡点“${tag}”挂进复检，下一轮直接回头看有没有真稳住。`;
}

function buildTriggerType(repeatCount30d: number, carryOver: boolean, paidTrackingEnabled: boolean) {
  if (repeatCount30d >= 2) return "repeat_error";
  if (carryOver) return "carry_over_unstable";
  if (paidTrackingEnabled) return "paid_tracking";
  return "new_followup";
}

function buildTaskStatus(triggerType: string): RecheckTaskStatus {
  return triggerType === "new_followup" ? "queued" : "recheck_due";
}

function mapTask(row: any): RecheckTaskDetail {
  return {
    id: row.id,
    studentId: row.student_id,
    diagnosisId: row.diagnosis_id,
    weeklyReportId: row.weekly_report_id,
    subject: row.subject,
    module: row.module,
    tag: row.tag,
    status: row.status,
    triggerType: row.trigger_type,
    triggerReason: row.trigger_reason,
    repeatCount7d: row.repeat_count_7d,
    repeatCount30d: row.repeat_count_30d,
    lastSeenAt: row.last_seen_at,
    lastRecheckAt: row.last_recheck_at,
    stabilizedScore: row.stabilized_score,
    stabilized: Boolean(row.stabilized),
    nextPriority: row.next_priority,
    nextRecheckReason: row.next_recheck_reason,
    nextActionType: row.next_action_type,
    continueTrackingReason: row.continue_tracking_reason,
    lastOutcome: row.last_outcome,
    attemptCount: row.attempt_count,
    passStreak: row.pass_streak,
    diagnosisMode: row.diagnosis_mode,
    paidTrackingEnabled: Boolean(row.paid_tracking_enabled),
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getOpenTask(studentId: number, subject: Subject, module: string, tag: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM recheck_tasks
    WHERE student_id = ?
      AND subject = ?
      AND module = ?
      AND tag = ?
      AND status != 'stabilized'
      AND status != 'dismissed'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).get(studentId, subject, module, tag);
  return row ? mapTask(row) : null;
}

function getLinkedTask(diagnosisId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT rt.* FROM recheck_tasks rt INNER JOIN diagnoses d ON d.recheck_task_id = rt.id WHERE d.id = ? LIMIT 1`).get(diagnosisId);
  return row ? mapTask(row) : null;
}

function listTaskDiagnoses(taskId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT d.id, d.created_at, d.recheck_outcome, d.problem_tags
    FROM diagnoses d
    WHERE d.recheck_task_id = ?
    ORDER BY d.created_at ASC, d.id ASC
  `).all(taskId) as Array<{ id: number; created_at: string; recheck_outcome: RecheckOutcome; problem_tags: string }>;
}

function computeOutcome(context: DiagnosisContext, tag: string): RecheckOutcome {
  const score = parseScore(context.scoreNote);
  const noteText = normalizeText(`${context.note ?? ""} ${context.studentSelfReport ?? ""}`);
  const passedByKeywords = /(通过|做对|稳住|会了|过关|ok|pass)/i.test(noteText);
  const blockedByKeywords = /(不会|还是错|没稳|卡住|没做出来)/.test(noteText);
  if ((score !== null && score >= 90) || passedByKeywords) {
    return "passed";
  }
  if (blockedByKeywords) {
    return "blocked";
  }
  if ((score !== null && score >= 80) || context.stepQuality === "clear" || !context.problemTags.includes(tag)) {
    return "improving";
  }
  return "blocked";
}

function hasNewErrorAfterPreviousPass(taskId: number, tag: string, currentDiagnosisId: number) {
  const attempts = listTaskDiagnoses(taskId);
  const previousPass = [...attempts].reverse().find((item) => item.id !== currentDiagnosisId && item.recheck_outcome === "passed");
  if (!previousPass) {
    return true;
  }

  return attempts.some((item) => {
    if (item.id === currentDiagnosisId || item.id === previousPass.id) return false;
    if (new Date(item.created_at) <= new Date(previousPass.created_at)) return false;
    return parseArray(item.problem_tags).includes(tag);
  });
}

function calculateStabilizedScore(repeatCount7d: number, repeatCount30d: number, passStreak: number, outcome: RecheckOutcome, stabilized: boolean) {
  const base = 34 + passStreak * 22 - repeatCount7d * 5 - repeatCount30d * 2 + (outcome === "passed" ? 10 : outcome === "improving" ? 4 : 0);
  if (stabilized) {
    return Math.min(100, Math.max(78, base + 15));
  }
  return Math.max(12, Math.min(92, base));
}

function updateDiagnosisRecheckFields(input: {
  diagnosisId: number;
  taskId: number | null;
  status: RecheckTaskStatus;
  outcome: RecheckOutcome;
  summary: string;
  nextPriority: string;
  nextRecheckReason: string;
  nextActionType: string;
  continueTrackingReason: string;
  stabilized: boolean;
  studentTodayAction: string;
  studentMinimumAction: string;
  studentSelfCheck: string;
}) {
  const db = getDb();
  db.prepare(`
    UPDATE diagnoses
    SET recheck_task_id = ?,
        recheck_status = ?,
        recheck_outcome = ?,
        recheck_summary = ?,
        next_priority = ?,
        next_recheck_reason = ?,
        next_action_type = ?,
        continue_tracking_reason = ?,
        stabilized = ?,
        student_today_action = ?,
        student_minimum_action = ?,
        student_self_check = ?
    WHERE id = ?
  `).run(
    input.taskId,
    input.status,
    input.outcome,
    input.summary,
    input.nextPriority,
    input.nextRecheckReason,
    input.nextActionType,
    input.continueTrackingReason,
    input.stabilized ? 1 : 0,
    input.studentTodayAction,
    input.studentMinimumAction,
    input.studentSelfCheck,
    input.diagnosisId
  );
}

function dismissBaselineTask(diagnosisId: number) {
  const db = getDb();
  const task = getLinkedTask(diagnosisId);
  if (task && task.diagnosisId === diagnosisId && task.attemptCount === 0) {
    db.prepare(`UPDATE recheck_tasks SET status = 'dismissed', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), task.id);
  }
  updateDiagnosisRecheckFields({
    diagnosisId,
    taskId: task?.id ?? null,
    status: "dismissed",
    outcome: "blocked",
    summary: "这条诊断这次没进正式链路，复检也先不往下排。",
    nextPriority: "先等下一条有效诊断出来，再决定复检顺序。",
    nextRecheckReason: "这条先不算正式依据。",
    nextActionType: "先等老师确认",
    continueTrackingReason: "先把有效诊断立住，再继续追踪才不乱。",
    stabilized: false,
    studentTodayAction: "今天先别加新任务，等老师确认这条诊断。",
    studentMinimumAction: "先把这道题留着，等下一条有效判断再练。",
    studentSelfCheck: "先别急着判自己会不会，这条还没正式入档。"
  });
}

function createTask(context: DiagnosisContext, tag: string, repeatCount7d: number, repeatCount30d: number, lastSeenAt: string | null, carryOver: boolean, paidTrackingEnabled: boolean): RecheckTaskDetail {
  const db = getDb();
  const triggerType = buildTriggerType(repeatCount30d, carryOver, paidTrackingEnabled);
  const triggerReason = buildTriggerReason(context, tag, repeatCount30d, carryOver, paidTrackingEnabled);
  const status = buildTaskStatus(triggerType);
  const nextActionType = buildNextActionType(context, tag);
  const nextPriority = `下一轮先回头看“${tag}”，别让这个点只好一天又掉回去。`;
  const nextRecheckReason = triggerReason;
  const now = new Date().toISOString();
  const continueTrackingReason = status === "recheck_due"
    ? `这类题最近重复得比较明显，或者上周明明有进步却没稳，所以这周一定要再检。`
    : `这次先挂一条复检，下一轮回头看同类题有没有真稳住。`;
  const result = db.prepare(`
    INSERT INTO recheck_tasks (
      student_id, diagnosis_id, weekly_report_id, subject, module, tag, status,
      trigger_type, trigger_reason, repeat_count_7d, repeat_count_30d, last_seen_at,
      last_recheck_at, stabilized_score, stabilized, next_priority, next_recheck_reason,
      next_action_type, continue_tracking_reason, paid_tracking_enabled, diagnosis_mode,
      last_outcome, attempt_count, pass_streak, due_date, created_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, 'baseline', 0, 0, ?, ?, ?)
  `).run(
    context.studentId,
    context.id,
    context.subject,
    context.module,
    tag,
    status,
    triggerType,
    triggerReason,
    repeatCount7d,
    repeatCount30d,
    lastSeenAt ?? context.createdAt,
    calculateStabilizedScore(repeatCount7d, repeatCount30d, 0, "baseline", false),
    nextPriority,
    nextRecheckReason,
    nextActionType,
    continueTrackingReason,
    paidTrackingEnabled ? 1 : 0,
    context.diagnosisMode,
    addDays(context.createdAt, 7),
    now,
    now
  );

  return mapTask(db.prepare(`SELECT * FROM recheck_tasks WHERE id = ?`).get(Number(result.lastInsertRowid)));
}

function updateTaskAttempt(task: RecheckTaskDetail, context: DiagnosisContext, repeatCount7d: number, repeatCount30d: number, lastSeenAt: string | null, outcome: RecheckOutcome) {
  const db = getDb();
  const nextActionType = buildNextActionType(context, task.tag);
  const nextPriority = outcome === "passed"
    ? `这类题这次有起色了，下一轮继续拿“${task.tag}”做一次同类复检。`
    : `这类题还没稳，下一轮继续盯“${task.tag}”，先别换主战场。`;
  const nextRecheckReason = outcome === "passed"
    ? `这类题已经有进步，但还没到可以放心放手的时候。`
    : `这类题这次还没压住，必须继续再检。`;
  const passStreak = outcome === "passed" ? task.passStreak + 1 : 0;
  const stabilized = outcome === "passed" && passStreak >= 2 && !hasNewErrorAfterPreviousPass(task.id, task.tag, context.id);
  const status: RecheckTaskStatus = stabilized
    ? "stabilized"
    : outcome === "passed"
      ? "passed_once"
      : "improving";
  const stabilizedScore = calculateStabilizedScore(repeatCount7d, repeatCount30d, passStreak, outcome, stabilized);
  const continueTrackingReason = buildContinueTrackingReason({
    ...task,
    status,
    stabilized,
    passStreak,
    repeatCount7d,
    repeatCount30d,
    lastSeenAt: lastSeenAt ?? task.lastSeenAt,
    lastRecheckAt: context.createdAt,
    stabilizedScore,
    nextPriority,
    nextRecheckReason,
    nextActionType
  });
  const previousStatus = task.status;

  db.prepare(`
    UPDATE recheck_tasks
    SET weekly_report_id = weekly_report_id,
        status = ?,
        repeat_count_7d = ?,
        repeat_count_30d = ?,
        last_seen_at = ?,
        last_recheck_at = ?,
        stabilized_score = ?,
        stabilized = ?,
        next_priority = ?,
        next_recheck_reason = ?,
        next_action_type = ?,
        continue_tracking_reason = ?,
        last_outcome = ?,
        attempt_count = ?,
        pass_streak = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    repeatCount7d,
    repeatCount30d,
    lastSeenAt ?? context.createdAt,
    context.createdAt,
    stabilizedScore,
    stabilized ? 1 : 0,
    nextPriority,
    nextRecheckReason,
    nextActionType,
    continueTrackingReason,
    outcome,
    task.attemptCount + 1,
    passStreak,
    new Date().toISOString(),
    task.id
  );

  const refreshed = mapTask(db.prepare(`SELECT * FROM recheck_tasks WHERE id = ?`).get(task.id));
  return { task: refreshed, previousStatus };
}

function buildTaskStudentActions(task: RecheckTaskDetail) {
  const studentTodayAction = task.nextActionType === "先补辅助线触发"
    ? "今天先拿一题，把该不该补辅助线先判断出来。"
    : task.nextActionType === "先把函数起手步骤练顺"
      ? "今天先做函数题第一步，别一上来就急着往后推。"
      : `今天先做一件事：${task.nextActionType}。`;
  const studentMinimumAction = `再练 1 个最小动作：只做一题同类题，把“${task.tag}”这一步单独练顺。`;
  const studentSelfCheck = `做完自己问一下：我这次的“${task.tag}”有没有比上次更稳一点？如果还不敢说稳，就继续同类复练。`;
  return { studentTodayAction, studentMinimumAction, studentSelfCheck };
}

function mapTaskToSyncResult(task: RecheckTaskDetail, diagnosisOutcome: RecheckOutcome, created: boolean, statusChanged: boolean, previousStatus: RecheckTaskStatus | null): RecheckSyncResult {
  const studentActions = buildTaskStudentActions(task);
  return {
    task,
    diagnosisOutcome,
    created,
    statusChanged,
    previousStatus,
    recheckSummary: buildSummaryFromTask(task),
    nextPriority: buildPriority(task),
    nextRecheckReason: task.nextRecheckReason,
    nextActionType: task.nextActionType,
    continueTrackingReason: buildContinueTrackingReason(task),
    studentTodayAction: studentActions.studentTodayAction,
    studentMinimumAction: studentActions.studentMinimumAction,
    studentSelfCheck: studentActions.studentSelfCheck
  };
}

export function syncRecheckForDiagnosis(diagnosisId: number): RecheckSyncResult {
  const context = getDiagnosisContext(diagnosisId);
  if (!context) {
    return {
      task: null,
      diagnosisOutcome: "blocked",
      created: false,
      statusChanged: false,
      previousStatus: null,
      recheckSummary: "这条诊断我没找到，复检先不往下排。",
      nextPriority: "先等有效诊断出来。",
      nextRecheckReason: "当前没有可用依据。",
      nextActionType: "先等新诊断",
      continueTrackingReason: "先把诊断链路立住，再继续追踪。",
      studentTodayAction: "今天先不加新动作。",
      studentMinimumAction: "先把这条留存。",
      studentSelfCheck: "等下一条有效诊断再看。"
    };
  }

  if (context.reviewStatus === "rejected") {
    dismissBaselineTask(diagnosisId);
    return {
      task: getLinkedTask(diagnosisId),
      diagnosisOutcome: "blocked",
      created: false,
      statusChanged: true,
      previousStatus: null,
      recheckSummary: "这条诊断先不继续排复检，等下一条有效判断。",
      nextPriority: "先把有效诊断立住。",
      nextRecheckReason: "当前这条没进正式链路。",
      nextActionType: "先等老师确认",
      continueTrackingReason: "先保证正式档案是对的，再继续追踪才不乱。",
      studentTodayAction: "今天先别加新任务。",
      studentMinimumAction: "先留着这题，等下一轮再看。",
      studentSelfCheck: "先别急着判稳不稳，这条还没正式入档。"
    };
  }

  const focus = pickFocusTag(context);
  const existingTask = getOpenTask(context.studentId, context.subject, context.module, focus.tag);

  if (!existingTask) {
    const task = createTask(context, focus.tag, focus.metrics.repeatCount7d, focus.metrics.repeatCount30d, focus.metrics.lastSeenAt, focus.carryOver, focus.paidTrackingEnabled);
    const result = mapTaskToSyncResult(task, "baseline", true, false, null);
    updateDiagnosisRecheckFields({
      diagnosisId,
      taskId: task.id,
      status: task.status,
      outcome: "baseline",
      summary: result.recheckSummary,
      nextPriority: result.nextPriority,
      nextRecheckReason: result.nextRecheckReason,
      nextActionType: result.nextActionType,
      continueTrackingReason: result.continueTrackingReason,
      stabilized: task.stabilized,
      studentTodayAction: result.studentTodayAction,
      studentMinimumAction: result.studentMinimumAction,
      studentSelfCheck: result.studentSelfCheck
    });
    return result;
  }

  if (existingTask.diagnosisId === diagnosisId && existingTask.attemptCount === 0) {
    const result = mapTaskToSyncResult(existingTask, "baseline", false, false, existingTask.status);
    updateDiagnosisRecheckFields({
      diagnosisId,
      taskId: existingTask.id,
      status: existingTask.status,
      outcome: "baseline",
      summary: result.recheckSummary,
      nextPriority: result.nextPriority,
      nextRecheckReason: result.nextRecheckReason,
      nextActionType: result.nextActionType,
      continueTrackingReason: result.continueTrackingReason,
      stabilized: existingTask.stabilized,
      studentTodayAction: result.studentTodayAction,
      studentMinimumAction: result.studentMinimumAction,
      studentSelfCheck: result.studentSelfCheck
    });
    return result;
  }

  const outcome = computeOutcome(context, existingTask.tag);
  const updated = updateTaskAttempt(existingTask, context, focus.metrics.repeatCount7d, focus.metrics.repeatCount30d, focus.metrics.lastSeenAt, outcome);
  const result = mapTaskToSyncResult(updated.task, outcome, false, updated.previousStatus !== updated.task.status, updated.previousStatus);
  updateDiagnosisRecheckFields({
    diagnosisId,
    taskId: updated.task.id,
    status: updated.task.status,
    outcome,
    summary: result.recheckSummary,
    nextPriority: result.nextPriority,
    nextRecheckReason: result.nextRecheckReason,
    nextActionType: result.nextActionType,
    continueTrackingReason: result.continueTrackingReason,
    stabilized: updated.task.stabilized,
    studentTodayAction: result.studentTodayAction,
    studentMinimumAction: result.studentMinimumAction,
    studentSelfCheck: result.studentSelfCheck
  });
  return result;
}

function getPriorityTask(studentId: number) {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM recheck_tasks
    WHERE student_id = ?
    ORDER BY
      CASE status
        WHEN 'recheck_due' THEN 0
        WHEN 'improving' THEN 1
        WHEN 'passed_once' THEN 2
        WHEN 'queued' THEN 3
        WHEN 'stabilized' THEN 4
        ELSE 5
      END,
      updated_at DESC,
      id DESC
    LIMIT 1
  `).get(studentId);
  return row ? mapTask(row) : null;
}

export function getStudentRecheckMemoryPatch(studentId = getPrimaryStudentId()): RecheckMemoryPatch {
  const task = getPriorityTask(studentId);
  if (!task) {
    return {
      nextPriority: "下一轮还是先盯最新主卡点，别一口气铺太多。",
      nextRecheckReason: "这周先把已有动作跑一轮，等新证据再决定复检顺序。",
      nextActionType: "先做一题同类复练",
      recheckStatusSummary: "这周还没挂出明确复检任务，先把最新动作做扎实。",
      lastRecheckAt: null
    };
  }

  return {
    nextPriority: buildPriority(task),
    nextRecheckReason: task.nextRecheckReason,
    nextActionType: task.nextActionType,
    recheckStatusSummary: buildSummaryFromTask(task),
    lastRecheckAt: task.lastRecheckAt
  };
}

export function getWeeklyReportRecheckOverlay(studentId = getPrimaryStudentId()): RecheckOverlay {
  const task = getPriorityTask(studentId);
  if (!task) {
    return {
      recheckStatus: "这周先把当前动作跑一轮，我先不额外挂复检压力。",
      nextPriority: "下一轮先盯最新主卡点。",
      continueTrackingReason: "先把一条动作跑顺，再谈下一轮复检。",
      studentTodayAction: "今天先做一题最接近这次卡点的题。",
      studentMinimumAction: "再练 1 个最小动作：把最容易掉链子的那一步单独做对。",
      studentSelfCheck: "做完回头看：我是不是比上次更清楚自己卡哪了？",
      improvedPoint: "已经开始建立复盘习惯。",
      unstablePoint: "主要问题还在继续观察。",
      repeatedTag: "本周高频错因还在收集。"
    };
  }

  return {
    recheckStatus: buildSummaryFromTask(task),
    nextPriority: buildPriority(task),
    continueTrackingReason: buildContinueTrackingReason(task),
    studentTodayAction: buildTaskStudentActions(task).studentTodayAction,
    studentMinimumAction: buildTaskStudentActions(task).studentMinimumAction,
    studentSelfCheck: buildTaskStudentActions(task).studentSelfCheck,
    improvedPoint: task.stabilized ? `这周已经稳住：${task.tag}。` : `这块开始有进步：${task.tag}。`,
    unstablePoint: task.stabilized ? `下一轮别让别的旧错因顶上来。` : `有进步，但还没稳：${task.tag}。`,
    repeatedTag: task.tag
  };
}

export function attachWeeklyReportToRecheckTasks(studentId: number, weeklyReportId: number) {
  const db = getDb();
  db.prepare(`UPDATE recheck_tasks SET weekly_report_id = ?, updated_at = ? WHERE student_id = ? AND status != 'dismissed'`).run(weeklyReportId, new Date().toISOString(), studentId);
}

export function listStudentRecheckTasks(studentId = getPrimaryStudentId()) {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM recheck_tasks WHERE student_id = ? ORDER BY updated_at DESC, id DESC`).all(studentId);
  return rows.map((row) => mapTask(row));
}

export function listAllRecheckTasks() {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM recheck_tasks ORDER BY updated_at DESC, id DESC`).all();
  return rows.map((row) => mapTask(row));
}
