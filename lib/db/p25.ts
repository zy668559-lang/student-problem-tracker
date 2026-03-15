import { getDb, getPrimaryStudentId, upsertWeeklyReport } from "@/lib/db";
import { appendAdminActionLog } from "@/lib/db/admin";
import { attachWeeklyReportToRecheckTasks, listAllRecheckTasks, listStudentRecheckTasks } from "@/lib/db/recheck";
import { appendStructuredChangeLog, ensureProductSchema, upsertStudentMemorySummary } from "@/lib/db/product";
import { generateWeeklyReport } from "@/lib/services/ai";
import type {
  AdminTrackingSnapshot,
  AppSession,
  RecheckManualDecision,
  RecheckOutcome,
  RecheckTaskDetail,
  RecheckTaskPageDetail,
  RecheckTaskStatus,
  ResultEventName,
  SubmissionType,
  Subject,
  TrackingClickDetail,
  TrackingIntentDetail,
  TrackingIntentStatus,
  TrackingStatus,
  WeeklyReportPayload
} from "@/lib/types";

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function parseArray(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(items: Array<string | null | undefined>, limit = 6) {
  return Array.from(new Set(items.map((item) => normalize(item)).filter(Boolean))).slice(0, limit);
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (part) => `\\${part}`);
}

function columnExists(table: string, column: string) {
  const db = getDb();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(table: string, column: string, sql: string) {
  if (!columnExists(table, column)) {
    getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${sql};`);
  }
}

function getTrackingStatus(studentId: number) {
  ensureP25Schema();
  const db = getDb();
  const row = db.prepare(`SELECT tracking_status, paid_tracking_enabled FROM trial_access WHERE student_id = ? LIMIT 1`).get(studentId) as { tracking_status: string | null; paid_tracking_enabled: number } | undefined;
  if (!row) return "trial" as TrackingStatus;
  if (row.paid_tracking_enabled) return "active";
  return row.tracking_status === "active" || row.tracking_status === "intent" ? row.tracking_status : "trial";
}

function setTrackingStatus(studentId: number, status: TrackingStatus) {
  ensureP25Schema();
  const db = getDb();
  db.prepare(`UPDATE trial_access SET tracking_status = ?, paid_tracking_enabled = ?, updated_at = ? WHERE student_id = ?`)
    .run(status, status === "active" ? 1 : 0, new Date().toISOString(), studentId);
}

function getLatestDiagnosisForTask(taskId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT d.id, d.current_stage, d.recheck_summary, d.student_today_action, d.subject, d.module
    FROM diagnoses d
    WHERE d.recheck_task_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  `).get(taskId) as {
    id: number;
    current_stage: string | null;
    recheck_summary: string | null;
    student_today_action: string | null;
    subject: Subject;
    module: string;
  } | undefined;
}

function getLatestDiagnosisForStudent(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT d.id, d.current_stage, d.subject, d.module
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  `).get(studentId) as { id: number; current_stage: string; subject: Subject; module: string } | undefined;
}

function getLatestWeeklyReportId(studentId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM weekly_reports WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(studentId) as { id: number } | undefined;
  return row?.id ?? null;
}

function getTaskWeight(task: RecheckTaskDetail) {
  const statusWeight = task.stabilized
    ? 0
    : task.status === "recheck_due"
      ? 40
      : task.status === "passed_once"
        ? 30
        : task.status === "improving"
          ? 25
          : task.status === "queued"
            ? 20
            : 0;
  return statusWeight + task.repeatCount7d * 4 + task.repeatCount30d * 2 + (task.paidTrackingEnabled ? 2 : 0);
}

function getPriorityTask(studentId: number) {
  const tasks = listStudentRecheckTasks(studentId).filter((task) => task.status !== "dismissed");
  return [...tasks].sort((left, right) => getTaskWeight(right) - getTaskWeight(left))[0] ?? null;
}

function buildRecheckUploadHint(subject: Subject, tag: string) {
  if (subject === "math") {
    return `最好传一张这类题重新做的过程图，能看见步骤最好。重点就盯“${tag}”，别一口气换太多题型。`;
  }
  return `最好传一张同类阅读/完形的过程图，能看到你怎么定位、怎么判断更好。重点先盯“${tag}”。`;
}

function buildDecisionCopy(task: RecheckTaskDetail, decision: RecheckManualDecision, reason: string | null, manualPriority: string | null) {
  if (decision === "stabilized") {
    return {
      status: "stabilized" as RecheckTaskStatus,
      outcome: "passed" as RecheckOutcome,
      stabilized: true,
      summary: `老师这边先给它记成已稳住：${task.tag}。这块先别天天盯，但也别彻底放手。`,
      nextPriority: manualPriority || `这块先记成已稳住，把火力转到下一个更容易反复的点。`,
      nextReason: reason || `因为这块已经连续过了两轮，老师这边先不给它算高风险。`,
      nextActionType: "转盯下一个高频点",
      continueTrackingReason: `这块已经稳了，但整体追踪不能断，下一轮要把火力转到新的重复错因。`
    };
  }

  if (decision === "unstable") {
    return {
      status: "passed_once" as RecheckTaskStatus,
      outcome: "improving" as RecheckOutcome,
      stabilized: false,
      summary: `这块是有起色了，但老师这边先不记稳：${task.tag}。还得再过一轮，看它会不会回去。`,
      nextPriority: manualPriority || `下一轮还是先盯 ${task.tag}，别刚好一点就松。`,
      nextReason: reason || `因为这块现在像是会了七八成，但还没到闭眼也能稳住。`,
      nextActionType: "再做一轮同类复检",
      continueTrackingReason: `这块已经有进步，但还没站住，不继续盯最容易回弹。`
    };
  }

  return {
    status: "recheck_due" as RecheckTaskStatus,
    outcome: "blocked" as RecheckOutcome,
    stabilized: false,
    summary: `这块先继续轰炸：${task.tag}。这轮别换方向，就把同类题连续压下去。`,
    nextPriority: manualPriority || `下轮先把 ${task.tag} 继续轰炸，别让它混过去。`,
    nextReason: reason || `因为这块反复回来得太勤，现在最怕的是看着懂了，隔一天又掉回去。`,
    nextActionType: "继续轰炸同类题",
    continueTrackingReason: `这块当前还是高风险点，不连续追踪基本稳不下来。`
  };
}

function mapTask(row: any): RecheckTaskDetail {
  const latest = getLatestDiagnosisForTask(row.id);
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? null,
    diagnosisId: row.diagnosis_id,
    weeklyReportId: row.weekly_report_id,
    subject: row.subject,
    module: row.module,
    tag: row.tag,
    status: row.status,
    triggerType: row.trigger_type,
    triggerReason: row.trigger_reason,
    repeatCount7d: Number(row.repeat_count_7d ?? 0),
    repeatCount30d: Number(row.repeat_count_30d ?? 0),
    lastSeenAt: row.last_seen_at,
    lastRecheckAt: row.last_recheck_at,
    stabilizedScore: Number(row.stabilized_score ?? 0),
    stabilized: Boolean(row.stabilized),
    nextPriority: row.next_priority,
    nextRecheckReason: row.next_recheck_reason,
    nextActionType: row.next_action_type,
    continueTrackingReason: row.continue_tracking_reason,
    lastOutcome: row.last_outcome,
    attemptCount: Number(row.attempt_count ?? 0),
    passStreak: Number(row.pass_streak ?? 0),
    diagnosisMode: row.diagnosis_mode,
    paidTrackingEnabled: Boolean(row.paid_tracking_enabled),
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestDiagnosisId: latest?.id ?? null,
    latestProblemSummary: latest?.recheck_summary ?? latest?.current_stage ?? null,
    latestStudentAction: latest?.student_today_action ?? null,
    manualOverrideStatus: row.manual_override_status ?? null,
    manualOverrideReason: row.manual_override_reason ?? null,
    manualOverridePriority: row.manual_override_priority ?? null,
    manualOverrideBy: row.manual_override_by ?? null,
    manualOverrideAt: row.manual_override_at ?? null
  };
}

export function ensureP25Schema() {
  ensureProductSchema();
  const db = getDb();

  ensureColumn("uploads", "submission_type", "submission_type TEXT DEFAULT 'diagnosis'");
  ensureColumn("uploads", "source_recheck_task_id", "source_recheck_task_id INTEGER");
  ensureColumn("trial_access", "tracking_status", "tracking_status TEXT DEFAULT 'trial'");
  ensureColumn("weekly_reports", "report_mode", "report_mode TEXT DEFAULT 'instant'");
  ensureColumn("weekly_reports", "batch_generated_at", "batch_generated_at TEXT");
  ensureColumn("weekly_reports", "student_report_json", "student_report_json TEXT DEFAULT '{}' ");
  ensureColumn("weekly_reports", "continue_tracking_recommended", "continue_tracking_recommended INTEGER DEFAULT 0");
  ensureColumn("recheck_tasks", "manual_override_status", "manual_override_status TEXT");
  ensureColumn("recheck_tasks", "manual_override_reason", "manual_override_reason TEXT");
  ensureColumn("recheck_tasks", "manual_override_priority", "manual_override_priority TEXT");
  ensureColumn("recheck_tasks", "manual_override_by", "manual_override_by INTEGER");
  ensureColumn("recheck_tasks", "manual_override_at", "manual_override_at TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracking_intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      diagnosis_id INTEGER,
      recheck_task_id INTEGER,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_weeks INTEGER NOT NULL DEFAULT 4,
      note TEXT,
      submitted_at TEXT,
      activated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id),
      FOREIGN KEY (recheck_task_id) REFERENCES recheck_tasks(id)
    );
  `);

  db.prepare(`UPDATE trial_access SET tracking_status = CASE WHEN paid_tracking_enabled = 1 THEN 'active' WHEN tracking_status IS NULL OR tracking_status = '' THEN 'trial' ELSE tracking_status END`).run();
}

export function recordSubmissionMeta(uploadId: number, input: { submissionType: SubmissionType; recheckTaskId?: number | null; }) {
  ensureP25Schema();
  const db = getDb();
  db.prepare(`UPDATE uploads SET submission_type = ?, source_recheck_task_id = ? WHERE id = ?`).run(input.submissionType, input.recheckTaskId ?? null, uploadId);
}

export function getSubmissionMetaByDiagnosis(diagnosisId: number) {
  ensureP25Schema();
  const db = getDb();
  const row = db.prepare(`
    SELECT u.submission_type, u.source_recheck_task_id
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE d.id = ?
    LIMIT 1
  `).get(diagnosisId) as { submission_type: SubmissionType | null; source_recheck_task_id: number | null } | undefined;

  return {
    submissionType: (row?.submission_type ?? "diagnosis") as SubmissionType,
    recheckTaskId: row?.source_recheck_task_id ?? null
  };
}

export function getRecheckTaskPageDetail(taskId: number, studentId = getPrimaryStudentId()): RecheckTaskPageDetail | null {
  ensureP25Schema();
  const db = getDb();
  const row = db.prepare(`
    SELECT rt.*, s.name AS student_name
    FROM recheck_tasks rt
    INNER JOIN students s ON s.id = rt.student_id
    WHERE rt.id = ? AND rt.student_id = ?
    LIMIT 1
  `).get(taskId, studentId);

  if (!row) return null;
  const task = mapTask(row);

  return {
    id: task.id,
    studentId: task.studentId,
    studentName: task.studentName ?? "这位孩子",
    subject: task.subject,
    module: task.module,
    tag: task.tag,
    status: task.status,
    lastProblemSummary: task.latestProblemSummary ?? task.triggerReason,
    currentGoal: task.nextPriority,
    uploadHint: buildRecheckUploadHint(task.subject, task.tag),
    compareDiagnosisId: task.latestDiagnosisId ?? task.diagnosisId,
    compareWeeklyReportId: task.weeklyReportId,
    latestDiagnosisId: task.latestDiagnosisId ?? task.diagnosisId,
    nextPriority: task.nextPriority,
    continueTrackingReason: task.continueTrackingReason,
    studentTodayAction: task.latestStudentAction ?? task.nextActionType
  };
}

export function getPriorityRecheckTask(studentId = getPrimaryStudentId()) {
  ensureP25Schema();
  return getPriorityTask(studentId);
}

function buildContinueTrackingRecommended(task: RecheckTaskDetail | null, trackingStatus: TrackingStatus) {
  return Boolean(task && !task.stabilized) || trackingStatus === "active";
}

export function decorateWeeklyPayload(studentId: number, payload: WeeklyReportPayload, mode: "instant" | "batch") {
  ensureP25Schema();
  const priorityTask = getPriorityTask(studentId);
  const tasks = listStudentRecheckTasks(studentId).filter((item) => item.status !== "dismissed");
  const stableItems = unique([
    ...payload.improved_points,
    ...tasks.filter((item) => item.stabilized).map((item) => `这周能先记成稳一点的是：${item.tag}`)
  ], 5);
  const unstableItems = unique([
    ...payload.unstable_points,
    ...tasks.filter((item) => !item.stabilized).slice(0, 4).map((item) => `这周还得继续盯的是：${item.tag}`)
  ], 5);
  const repeatedTags = unique([
    ...payload.repeated_error_tags,
    ...tasks.filter((item) => !item.stabilized).slice(0, 4).map((item) => item.tag)
  ], 6);
  const trackingStatus = getTrackingStatus(studentId);
  const continueTracking = buildContinueTrackingRecommended(priorityTask, trackingStatus);
  const continueLabel = continueTracking ? "建议继续追踪" : "这周可以先轻盯";
  const generatedAt = new Date().toISOString();

  const parentSummary = priorityTask
    ? `这周最该盯的还是 ${priorityTask.tag}。稳住的先别完全松手，没稳的别换题型，下一轮继续顺着这条线看变化。`
    : `这周先把现有动作跑完，等下一条诊断出来，我再帮你决定要不要继续追踪。`;
  const studentSummary = priorityTask
    ? `这周你先别贪多，就盯 ${priorityTask.tag}。把今天这一步做顺，再做一题最接近的同类题就够了。`
    : `这周先把老师给的动作做完，别一下铺太多。`;

  const nextWeekPlan = unique([
    ...payload.next_week_plan,
    priorityTask?.nextPriority,
    continueTracking ? `如果这块还没稳，下周继续追踪，不急着换线。` : `下周先轻盯已稳住项，别让它悄悄回弹。`
  ], 5);

  const merged: WeeklyReportPayload = {
    ...payload,
    improved_points: stableItems,
    unstable_points: unstableItems,
    repeated_error_tags: repeatedTags,
    next_week_plan: nextWeekPlan,
    recheck_status: priorityTask?.status === "stabilized"
      ? `这周有一块先能记成已稳住：${priorityTask.tag}。`
      : priorityTask?.continueTrackingReason ?? payload.recheck_status,
    next_priority: priorityTask?.nextPriority ?? payload.next_priority,
    continue_tracking_reason: priorityTask?.continueTrackingReason ?? payload.continue_tracking_reason,
    student_today_action: priorityTask?.latestStudentAction ?? priorityTask?.nextActionType ?? payload.student_today_action,
    student_minimum_action: priorityTask?.nextActionType ?? payload.student_minimum_action,
    student_self_check: payload.student_self_check ?? `做完回头看：这次到底是真稳了，还是只是这道题碰巧做对。`,
    parent_weekly_summary: parentSummary,
    student_weekly_summary: studentSummary,
    continue_tracking_recommended: continueTracking,
    continue_tracking_label: continueLabel,
    batch_summary_generated_at: generatedAt
  };

  return {
    payload: merged,
    reportMode: mode,
    batchGeneratedAt: mode === "batch" ? generatedAt : null,
    studentReportJson: {
      summary: studentSummary,
      todayAction: merged.student_today_action,
      minimumAction: merged.student_minimum_action,
      selfCheck: merged.student_self_check
    },
    continueTrackingRecommended: continueTracking
  };
}

export function persistWeeklyReportArtifacts(input: {
  reportId: number;
  mode: "instant" | "batch";
  studentReportJson: Record<string, unknown>;
  continueTrackingRecommended: boolean;
  batchGeneratedAt?: string | null;
}) {
  ensureP25Schema();
  const db = getDb();
  db.prepare(`
    UPDATE weekly_reports
    SET report_mode = ?, student_report_json = ?, continue_tracking_recommended = ?, batch_generated_at = ?
    WHERE id = ?
  `).run(input.mode, stringify(input.studentReportJson), input.continueTrackingRecommended ? 1 : 0, input.batchGeneratedAt ?? null, input.reportId);
}

export async function runWeeklyBatchForStudent(studentId: number) {
  ensureP25Schema();
  const base = await generateWeeklyReport(studentId);
  const enriched = decorateWeeklyPayload(studentId, base, "batch");
  const reportId = upsertWeeklyReport(studentId, enriched.payload);
  persistWeeklyReportArtifacts({
    reportId,
    mode: "batch",
    studentReportJson: enriched.studentReportJson,
    continueTrackingRecommended: enriched.continueTrackingRecommended,
    batchGeneratedAt: enriched.batchGeneratedAt
  });
  attachWeeklyReportToRecheckTasks(studentId, reportId);
  upsertStudentMemorySummary(studentId);
  return { reportId, payload: enriched.payload };
}

export async function runWeeklyBatchForAllStudents() {
  ensureP25Schema();
  const db = getDb();
  const studentRows = db.prepare(`SELECT id FROM students ORDER BY id ASC`).all() as Array<{ id: number }>;
  const results: Array<{ studentId: number; reportId: number }> = [];
  for (const row of studentRows) {
    const result = await runWeeklyBatchForStudent(row.id);
    results.push({ studentId: row.id, reportId: result.reportId });
  }
  return results;
}

export function listAdminRecheckTasksDetailed() {
  ensureP25Schema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT rt.*, s.name AS student_name
    FROM recheck_tasks rt
    INNER JOIN students s ON s.id = rt.student_id
    ORDER BY rt.updated_at DESC, rt.id DESC
  `).all();
  return rows.map((row) => mapTask(row));
}

export async function applyManualRecheckDecision(input: {
  taskId: number;
  decision: RecheckManualDecision;
  manualPriority?: string | null;
  reason?: string | null;
  adminSession: AppSession;
}) {
  ensureP25Schema();
  const db = getDb();
  const row = db.prepare(`SELECT * FROM recheck_tasks WHERE id = ? LIMIT 1`).get(input.taskId);
  if (!row) {
    throw new Error("recheck_task_not_found");
  }

  const task = mapTask(row);
  const copy = buildDecisionCopy(task, input.decision, input.reason ?? null, input.manualPriority ?? null);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE recheck_tasks
    SET status = ?,
        stabilized = ?,
        next_priority = ?,
        next_recheck_reason = ?,
        next_action_type = ?,
        continue_tracking_reason = ?,
        last_outcome = ?,
        manual_override_status = ?,
        manual_override_reason = ?,
        manual_override_priority = ?,
        manual_override_by = ?,
        manual_override_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    copy.status,
    copy.stabilized ? 1 : 0,
    copy.nextPriority,
    copy.nextReason,
    copy.nextActionType,
    copy.continueTrackingReason,
    copy.outcome,
    input.decision,
    input.reason ?? null,
    input.manualPriority ?? null,
    input.adminSession.userId,
    now,
    now,
    task.id
  );

  const latestDiagnosisId = task.latestDiagnosisId ?? task.diagnosisId;
  if (latestDiagnosisId) {
    db.prepare(`
      UPDATE diagnoses
      SET recheck_status = ?,
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
      copy.status,
      copy.outcome,
      copy.summary,
      copy.nextPriority,
      copy.nextReason,
      copy.nextActionType,
      copy.continueTrackingReason,
      copy.stabilized ? 1 : 0,
      copy.nextActionType,
      copy.nextActionType,
      `做完回头看：${task.tag} 这类题，这次到底是真稳了，还是只是老师刚提醒过。`,
      latestDiagnosisId
    );
  }

  appendStructuredChangeLog({
    studentId: task.studentId,
    subject: task.subject,
    module: task.module,
    changeType: "reviewer_corrected",
    description: copy.summary,
    relatedDiagnosisId: latestDiagnosisId ?? null,
    stabilizedIssues: copy.stabilized ? [task.tag] : [],
    unstableIssues: copy.stabilized ? [] : [task.tag],
    repeatedErrorTags: [task.tag],
    evidenceSummary: copy.nextReason,
    recheckTaskId: task.id,
    repeatCount7d: task.repeatCount7d,
    repeatCount30d: task.repeatCount30d,
    lastSeenAt: task.lastSeenAt,
    lastRecheckAt: now,
    stabilizedScore: copy.stabilized ? 95 : Math.max(35, task.stabilizedScore),
    nextPriority: copy.nextPriority,
    nextRecheckReason: copy.nextReason,
    nextActionType: copy.nextActionType,
    stabilized: copy.stabilized
  });

  const weeklyBase = await generateWeeklyReport(task.studentId);
  const weekly = decorateWeeklyPayload(task.studentId, weeklyBase, "instant");
  const weeklyReportId = upsertWeeklyReport(task.studentId, weekly.payload);
  persistWeeklyReportArtifacts({
    reportId: weeklyReportId,
    mode: "instant",
    studentReportJson: weekly.studentReportJson,
    continueTrackingRecommended: weekly.continueTrackingRecommended,
    batchGeneratedAt: null
  });
  attachWeeklyReportToRecheckTasks(task.studentId, weeklyReportId);
  upsertStudentMemorySummary(task.studentId);

  appendAdminActionLog({
    userId: input.adminSession.userId,
    userRole: input.adminSession.role,
    actionType: "review_recheck_task",
    targetType: "recheck_task",
    targetId: task.id,
    detail: `人工改复检：decision=${input.decision} priority=${input.manualPriority ?? ""} reason=${input.reason ?? ""}`
  });

  const refreshed = db.prepare(`SELECT rt.*, s.name AS student_name FROM recheck_tasks rt INNER JOIN students s ON s.id = rt.student_id WHERE rt.id = ? LIMIT 1`).get(task.id);
  return { task: mapTask(refreshed), weeklyReportId };
}

export function createTrackingIntent(input: {
  studentId: number;
  diagnosisId?: number | null;
  recheckTaskId?: number | null;
  requestedWeeks?: number;
  note?: string | null;
}) {
  ensureP25Schema();
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tracking_intents (
      student_id, diagnosis_id, recheck_task_id, source, status, requested_weeks, note, submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'result_cta', 'intent_submitted', ?, ?, ?, ?, ?)
  `).run(input.studentId, input.diagnosisId ?? null, input.recheckTaskId ?? null, input.requestedWeeks ?? 4, input.note ?? null, now, now, now);

  if (getTrackingStatus(input.studentId) !== "active") {
    setTrackingStatus(input.studentId, "intent");
  }

  return Number(result.lastInsertRowid);
}

export function listTrackingSnapshotAdmin(): AdminTrackingSnapshot {
  ensureP25Schema();
  const db = getDb();

  const clicks = db.prepare(`
    SELECT rpe.id, rpe.student_id, s.name AS student_name, u.name AS parent_name, rpe.diagnosis_id, rpe.event_name, rpe.created_at, rpe.event_value
    FROM result_page_events rpe
    INNER JOIN students s ON s.id = rpe.student_id
    INNER JOIN users u ON u.id = s.user_id
    WHERE rpe.event_name IN ('click_continue_tracking', 'submit_tracking_intent')
    ORDER BY rpe.created_at DESC
    LIMIT 20
  `).all() as Array<any>;

  const intents = db.prepare(`
    SELECT ti.id, ti.student_id, s.name AS student_name, u.name AS parent_name, ti.diagnosis_id, ti.recheck_task_id, ti.requested_weeks, ti.note, ti.status, ti.source, ta.tracking_status, ti.submitted_at, ti.activated_at, ti.created_at
    FROM tracking_intents ti
    INNER JOIN students s ON s.id = ti.student_id
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN trial_access ta ON ta.student_id = ti.student_id
    ORDER BY ti.created_at DESC
    LIMIT 20
  `).all() as Array<any>;

  const activeRows = db.prepare(`
    SELECT ta.id, ta.student_id, s.name AS student_name, u.name AS parent_name, ta.tracking_status, ta.updated_at
    FROM trial_access ta
    INNER JOIN students s ON s.id = ta.student_id
    INNER JOIN users u ON u.id = s.user_id
    WHERE ta.paid_tracking_enabled = 1 OR ta.tracking_status = 'active'
    ORDER BY ta.updated_at DESC, ta.id DESC
  `).all() as Array<any>;

  return {
    clicks: clicks.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      parentName: row.parent_name,
      diagnosisId: row.diagnosis_id,
      eventName: row.event_name as ResultEventName,
      createdAt: row.created_at,
      eventValue: row.event_value
    })) satisfies TrackingClickDetail[],
    intents: intents.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      parentName: row.parent_name,
      diagnosisId: row.diagnosis_id,
      recheckTaskId: row.recheck_task_id,
      requestedWeeks: row.requested_weeks,
      note: row.note,
      status: row.status as TrackingIntentStatus,
      source: row.source,
      trackingStatus: (row.tracking_status ?? "trial") as TrackingStatus,
      submittedAt: row.submitted_at,
      activatedAt: row.activated_at,
      createdAt: row.created_at
    })) satisfies TrackingIntentDetail[],
    activeStudents: activeRows.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      parentName: row.parent_name,
      diagnosisId: null,
      recheckTaskId: null,
      requestedWeeks: 4,
      note: "已开通 4 周追踪",
      status: "activated" as TrackingIntentStatus,
      source: "trial_access",
      trackingStatus: "active" as TrackingStatus,
      submittedAt: row.updated_at,
      activatedAt: row.updated_at,
      createdAt: row.updated_at
    })) satisfies TrackingIntentDetail[]
  };
}

export function activateTrackingIntent(intentId: number, adminSession: AppSession) {
  ensureP25Schema();
  const db = getDb();
  const intent = db.prepare(`SELECT * FROM tracking_intents WHERE id = ? LIMIT 1`).get(intentId) as { id: number; student_id: number } | undefined;
  if (!intent) {
    throw new Error("tracking_intent_not_found");
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE tracking_intents SET status = 'activated', activated_at = ?, updated_at = ? WHERE id = ?`).run(now, now, intentId);
  setTrackingStatus(intent.student_id, "active");

  appendAdminActionLog({
    userId: adminSession.userId,
    userRole: adminSession.role,
    actionType: "activate_tracking_intent",
    targetType: "tracking_intent",
    targetId: intentId,
    detail: `标记学生 ${intent.student_id} 已开通 4 周追踪`
  });
}
