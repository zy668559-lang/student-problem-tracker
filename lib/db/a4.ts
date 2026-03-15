import { getDb, getLatestWeeklyReport, getPrimaryStudentId } from "@/lib/db";
import { appendAdminActionLog, ensureAdminSchema } from "@/lib/db/admin";
import { ensureP25Schema, runWeeklyBatchForAllStudents } from "@/lib/db/p25";
import { getRecommendedSkillAssetByDiagnosis, getStudentMemorySummary } from "@/lib/db/product";
import { listStudentRecheckTasks } from "@/lib/db/recheck";
import type {
  AppSession,
  EvidenceTimelineDetail,
  EvidenceTimelineNode,
  LeadFollowupDetail,
  LeadFollowupStatus,
  ResultCompareDetail,
  ResultEventName,
  WeeklyBatchRunDetail,
  WeeklyBatchRunStatus,
  WeeklyBatchSchedulerSnapshot
} from "@/lib/types";

const WEEKLY_BATCH_JOB = "weekly_report_batch";
const WEEKLY_INTERVAL_MINUTES = 7 * 24 * 60;
const FAILED_RETRY_MINUTES = 60;
const RUNNING_WINDOW_MINUTES = 20;

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

function parseObject<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
function unique(items: Array<string | null | undefined>, limit = 4) {
  return Array.from(new Set(items.map((item) => (item ?? "").trim()).filter(Boolean))).slice(0, limit);
}

function addMinutes(input: string, minutes: number) {
  const date = new Date(input);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeFollowupStatus(value: string | null | undefined): LeadFollowupStatus {
  if (value === "new_intent" || value === "contacted" || value === "follow_up_pending" || value === "activated" || value === "not_needed" || value === "rejected") {
    return value;
  }
  return "new_intent";
}

function normalizeRunStatus(value: string | null | undefined): WeeklyBatchRunStatus | null {
  if (value === "running" || value === "success" || value === "failed") {
    return value;
  }
  return null;
}

function mapRun(row: any): WeeklyBatchRunDetail {
  return {
    id: row.id,
    jobName: row.job_name,
    triggerSource: row.trigger_source,
    triggeredBy: row.triggered_by,
    triggeredByName: row.triggered_by_name ?? null,
    status: row.status,
    reportCount: Number(row.report_count ?? 0),
    errorMessage: row.error_message ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    createdAt: row.created_at
  };
}

function mapFollowup(row: any): LeadFollowupDetail {
  return {
    id: row.id,
    trackingIntentId: row.tracking_intent_id ?? null,
    userId: row.user_id,
    userName: row.user_name,
    studentId: row.student_id,
    studentName: row.student_name,
    diagnosisId: row.diagnosis_id ?? null,
    recheckTaskId: row.recheck_task_id ?? null,
    clickSource: row.click_source,
    status: normalizeFollowupStatus(row.status),
    intentAt: row.intent_at,
    lastContactAt: row.last_contact_at ?? null,
    followUpNote: row.follow_up_note ?? null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function ensureA4Schema() {
  ensureP25Schema();
  ensureAdminSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_batch_scheduler (
      job_name TEXT PRIMARY KEY,
      interval_minutes INTEGER NOT NULL,
      next_run_at TEXT NOT NULL,
      last_run_at TEXT,
      last_status TEXT,
      last_error TEXT,
      last_report_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_batch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      trigger_source TEXT NOT NULL,
      triggered_by INTEGER,
      status TEXT NOT NULL,
      report_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (triggered_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lead_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_intent_id INTEGER,
      user_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      diagnosis_id INTEGER,
      recheck_task_id INTEGER,
      click_source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new_intent',
      intent_at TEXT NOT NULL,
      last_contact_at TEXT,
      follow_up_note TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tracking_intent_id) REFERENCES tracking_intents(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id),
      FOREIGN KEY (recheck_task_id) REFERENCES recheck_tasks(id)
    );
  `);

  const existing = db.prepare(`SELECT job_name FROM weekly_batch_scheduler WHERE job_name = ? LIMIT 1`).get(WEEKLY_BATCH_JOB) as { job_name: string } | undefined;
  if (!existing) {
    const now = nowIso();
    db.prepare(`INSERT INTO weekly_batch_scheduler (job_name, interval_minutes, next_run_at, last_run_at, last_status, last_error, last_report_count, updated_at) VALUES (?, ?, ?, NULL, NULL, NULL, 0, ?)`)
      .run(WEEKLY_BATCH_JOB, WEEKLY_INTERVAL_MINUTES, now, now);
  }
}

function getSchedulerRow() {
  ensureA4Schema();
  const db = getDb();
  return db.prepare(`SELECT * FROM weekly_batch_scheduler WHERE job_name = ? LIMIT 1`).get(WEEKLY_BATCH_JOB) as {
    job_name: string;
    interval_minutes: number;
    next_run_at: string;
    last_run_at: string | null;
    last_status: string | null;
    last_error: string | null;
    last_report_count: number;
    updated_at: string;
  };
}

function hasRunningBatch() {
  const db = getDb();
  const row = db.prepare(`
    SELECT id
    FROM weekly_batch_runs
    WHERE job_name = ?
      AND status = 'running'
      AND datetime(started_at) >= datetime('now', ?)
    ORDER BY id DESC
    LIMIT 1
  `).get(WEEKLY_BATCH_JOB, `-${RUNNING_WINDOW_MINUTES} minutes`) as { id: number } | undefined;
  return Boolean(row);
}

export function listWeeklyBatchRuns(limit = 8) {
  ensureA4Schema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT wbr.*, u.name AS triggered_by_name
    FROM weekly_batch_runs wbr
    LEFT JOIN users u ON u.id = wbr.triggered_by
    WHERE wbr.job_name = ?
    ORDER BY wbr.id DESC
    LIMIT ?
  `).all(WEEKLY_BATCH_JOB, limit) as any[];
  return rows.map((row) => mapRun(row));
}

export function getWeeklyBatchSchedulerSnapshot(): WeeklyBatchSchedulerSnapshot {
  const row = getSchedulerRow();
  return {
    jobName: row.job_name,
    intervalMinutes: row.interval_minutes,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastStatus: normalizeRunStatus(row.last_status),
    lastError: row.last_error,
    lastReportCount: Number(row.last_report_count ?? 0),
    updatedAt: row.updated_at,
    recentRuns: listWeeklyBatchRuns(8)
  };
}

export async function runWeeklyBatchJob(input: { triggerSource: string; adminSession?: AppSession | null }) {
  ensureA4Schema();
  const db = getDb();
  if (hasRunningBatch()) {
    return { ok: true, skipped: true, reason: "already_running", snapshot: getWeeklyBatchSchedulerSnapshot() };
  }

  const startedAt = nowIso();
  const runId = Number(db.prepare(`INSERT INTO weekly_batch_runs (job_name, trigger_source, triggered_by, status, report_count, error_message, started_at, finished_at, created_at) VALUES (?, ?, ?, 'running', 0, NULL, ?, NULL, ?)`)
    .run(WEEKLY_BATCH_JOB, input.triggerSource, input.adminSession?.userId ?? null, startedAt, startedAt).lastInsertRowid);

  db.prepare(`UPDATE weekly_batch_scheduler SET last_status = 'running', last_error = NULL, updated_at = ? WHERE job_name = ?`).run(startedAt, WEEKLY_BATCH_JOB);

  try {
    const items = await runWeeklyBatchForAllStudents();
    const finishedAt = nowIso();
    db.prepare(`UPDATE weekly_batch_runs SET status = 'success', report_count = ?, finished_at = ? WHERE id = ?`).run(items.length, finishedAt, runId);
    db.prepare(`UPDATE weekly_batch_scheduler SET next_run_at = ?, last_run_at = ?, last_status = 'success', last_error = NULL, last_report_count = ?, updated_at = ? WHERE job_name = ?`)
      .run(addMinutes(finishedAt, WEEKLY_INTERVAL_MINUTES), finishedAt, items.length, finishedAt, WEEKLY_BATCH_JOB);

    if (input.adminSession) {
      appendAdminActionLog({
        userId: input.adminSession.userId,
        userRole: input.adminSession.role,
        actionType: "run_weekly_batch",
        targetType: "weekly_reports",
        targetId: null,
        detail: `批处理生成本周周报，共 ${items.length} 个学生。`
      });
    }

    return { ok: true, skipped: false, items, snapshot: getWeeklyBatchSchedulerSnapshot() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "weekly_batch_failed";
    const finishedAt = nowIso();
    db.prepare(`UPDATE weekly_batch_runs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`).run(message, finishedAt, runId);
    db.prepare(`UPDATE weekly_batch_scheduler SET next_run_at = ?, last_run_at = ?, last_status = 'failed', last_error = ?, updated_at = ? WHERE job_name = ?`)
      .run(addMinutes(finishedAt, FAILED_RETRY_MINUTES), finishedAt, message, finishedAt, WEEKLY_BATCH_JOB);

    if (input.adminSession) {
      appendAdminActionLog({
        userId: input.adminSession.userId,
        userRole: input.adminSession.role,
        actionType: "run_weekly_batch_failed",
        targetType: "weekly_reports",
        targetId: null,
        detail: `周报批处理失败：${message}`
      });
    }

    return { ok: false, skipped: false, message, snapshot: getWeeklyBatchSchedulerSnapshot() };
  }
}

export async function maybeRunWeeklyBatchScheduler(triggerSource: string) {
  const scheduler = getSchedulerRow();
  if (new Date(scheduler.next_run_at) > new Date() || hasRunningBatch()) {
    return { triggered: false, snapshot: getWeeklyBatchSchedulerSnapshot() };
  }

  await runWeeklyBatchJob({ triggerSource: `auto:${triggerSource}` });
  return { triggered: true, snapshot: getWeeklyBatchSchedulerSnapshot() };
}

export function getResultCompareDetail(taskId: number, studentId = getPrimaryStudentId()): ResultCompareDetail | null {
  ensureA4Schema();
  const db = getDb();
  const task = db.prepare(`
    SELECT rt.id, rt.student_id, rt.diagnosis_id, rt.weekly_report_id, rt.tag, rt.stabilized, rt.next_priority, rt.continue_tracking_reason, s.name AS student_name
    FROM recheck_tasks rt
    INNER JOIN students s ON s.id = rt.student_id
    WHERE rt.id = ? AND rt.student_id = ?
    LIMIT 1
  `).get(taskId, studentId) as {
    id: number;
    student_id: number;
    diagnosis_id: number | null;
    weekly_report_id: number | null;
    tag: string;
    stabilized: number;
    next_priority: string | null;
    continue_tracking_reason: string | null;
    student_name: string;
  } | undefined;

  if (!task) return null;

  const diagnoses = db.prepare(`
    SELECT d.id, d.current_stage, d.problem_tags, d.recheck_summary, d.next_priority, d.continue_tracking_reason, d.created_at
    FROM diagnoses d
    WHERE d.recheck_task_id = ?
    ORDER BY d.created_at ASC, d.id ASC
  `).all(taskId) as Array<{
    id: number;
    current_stage: string;
    problem_tags: string;
    recheck_summary: string | null;
    next_priority: string | null;
    continue_tracking_reason: string | null;
    created_at: string;
  }>;

  const first = diagnoses[0];
  const latest = diagnoses[diagnoses.length - 1] ?? first;
  const firstTags = parseArray(first?.problem_tags ?? null);
  const latestTags = parseArray(latest?.problem_tags ?? null);
  const compareReady = diagnoses.length > 1;
  const stabilizedItems = task.stabilized
    ? [`这块这轮先能记成已稳住：${task.tag}`]
    : unique(firstTags.filter((item) => !latestTags.includes(item)).map((item) => `比上次稳一点的是：${item}`), 3);
  const unstableItems = task.stabilized
    ? unique(latestTags.map((item) => `这周先轻盯：${item}`), 3)
    : unique([task.tag, ...latestTags].map((item) => `还没完全站住的是：${item}`), 4);
  const suggestedAsset = latest?.id ? getRecommendedSkillAssetByDiagnosis(latest.id) : null;
  const latestWeeklyReportId = task.weekly_report_id ?? getLatestWeeklyReport(studentId);

  return {
    taskId: task.id,
    studentId: task.student_id,
    studentName: task.student_name,
    diagnosisId: task.diagnosis_id,
    latestDiagnosisId: latest?.id ?? task.diagnosis_id,
    latestWeeklyReportId,
    lastProblemSummary: first?.current_stage ?? `上次主要还是卡在 ${task.tag}。`,
    currentRecheckResult: latest?.recheck_summary ?? (compareReady ? "这轮已经补了复检，我先把新变化接进来。" : "这轮还没正式补复检，先按上次主问题挂着。"),
    stabilizedItems: stabilizedItems.length > 0 ? stabilizedItems : ["这轮先别急着记稳，我还想再看一轮。"],
    unstableItems: unstableItems.length > 0 ? unstableItems : ["暂时没有新的未稳项。"],
    nextPriority: latest?.next_priority ?? task.next_priority ?? `下轮还是先盯 ${task.tag}。`,
    continueTrackingReason: latest?.continue_tracking_reason ?? task.continue_tracking_reason ?? "因为这类题最容易出现看着有起色，过两天又掉回去。",
    suggestedAssetTitle: suggestedAsset?.title ?? null,
    suggestedAssetSummary: suggestedAsset?.summary ?? null,
    suggestedAssetId: suggestedAsset?.id ?? null,
    suggestedAssetPaidOnly: suggestedAsset?.paidOnly ?? false,
    compareReady
  };
}

export function syncLeadFollowupFromTrackingIntent(intentId: number) {
  ensureA4Schema();
  const db = getDb();
  const intent = db.prepare(`
    SELECT ti.id, ti.student_id, ti.diagnosis_id, ti.recheck_task_id, ti.source, ti.status, ti.note, ti.submitted_at, ti.created_at, s.user_id
    FROM tracking_intents ti
    INNER JOIN students s ON s.id = ti.student_id
    WHERE ti.id = ?
    LIMIT 1
  `).get(intentId) as {
    id: number;
    student_id: number;
    diagnosis_id: number | null;
    recheck_task_id: number | null;
    source: string;
    status: string;
    note: string | null;
    submitted_at: string | null;
    created_at: string;
    user_id: number;
  } | undefined;

  if (!intent) return null;

  const existing = db.prepare(`SELECT id, status, follow_up_note, rejection_reason FROM lead_followups WHERE tracking_intent_id = ? LIMIT 1`).get(intentId) as { id: number; status: string; follow_up_note: string | null; rejection_reason: string | null } | undefined;
  const derivedStatus: LeadFollowupStatus = intent.status === "activated" ? "activated" : existing ? normalizeFollowupStatus(existing.status) : "new_intent";
  const now = nowIso();

  if (existing) {
    db.prepare(`
      UPDATE lead_followups
      SET user_id = ?, student_id = ?, diagnosis_id = ?, recheck_task_id = ?, click_source = ?, status = ?, intent_at = ?, follow_up_note = ?, updated_at = ?
      WHERE id = ?
    `).run(
      intent.user_id,
      intent.student_id,
      intent.diagnosis_id,
      intent.recheck_task_id,
      intent.source,
      derivedStatus,
      intent.submitted_at ?? intent.created_at,
      existing.follow_up_note ?? intent.note ?? null,
      now,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO lead_followups (
      tracking_intent_id, user_id, student_id, diagnosis_id, recheck_task_id, click_source, status, intent_at, last_contact_at, follow_up_note, rejection_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)
  `).run(
    intent.id,
    intent.user_id,
    intent.student_id,
    intent.diagnosis_id,
    intent.recheck_task_id,
    intent.source,
    derivedStatus,
    intent.submitted_at ?? intent.created_at,
    intent.note ?? null,
    now,
    now
  );
  return Number(result.lastInsertRowid);
}

export function listLeadFollowups() {
  ensureA4Schema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT lf.*, u.name AS user_name, s.name AS student_name
    FROM lead_followups lf
    INNER JOIN users u ON u.id = lf.user_id
    INNER JOIN students s ON s.id = lf.student_id
    ORDER BY datetime(lf.intent_at) DESC, lf.id DESC
  `).all() as any[];
  return rows.map((row) => mapFollowup(row));
}

export function updateLeadFollowup(input: {
  id: number;
  status: LeadFollowupStatus;
  followUpNote?: string | null;
  rejectionReason?: string | null;
  adminSession: AppSession;
}) {
  ensureA4Schema();
  const db = getDb();
  const row = db.prepare(`SELECT * FROM lead_followups WHERE id = ? LIMIT 1`).get(input.id) as any;
  if (!row) {
    throw new Error("lead_followup_not_found");
  }

  const now = nowIso();
  const rejectionReason = input.status === "rejected" ? (input.rejectionReason ?? row.rejection_reason ?? "家长这轮先不接") : input.status === "not_needed" ? (input.rejectionReason ?? row.rejection_reason ?? "这轮先不需要继续追踪") : null;
  const lastContactAt = input.status === "contacted" || input.status === "follow_up_pending" || input.status === "activated" ? now : row.last_contact_at ?? null;

  db.prepare(`
    UPDATE lead_followups
    SET status = ?,
        last_contact_at = ?,
        follow_up_note = ?,
        rejection_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(input.status, lastContactAt, input.followUpNote ?? row.follow_up_note ?? null, rejectionReason, now, input.id);

  if (row.tracking_intent_id) {
    if (input.status === "activated") {
      db.prepare(`UPDATE tracking_intents SET status = 'activated', activated_at = ?, updated_at = ? WHERE id = ?`).run(now, now, row.tracking_intent_id);
      db.prepare(`UPDATE trial_access SET tracking_status = 'active', paid_tracking_enabled = 1, updated_at = ? WHERE student_id = ?`).run(now, row.student_id);
    } else if (input.status === "rejected" || input.status === "not_needed") {
      db.prepare(`UPDATE tracking_intents SET status = 'closed', updated_at = ? WHERE id = ?`).run(now, row.tracking_intent_id);
      db.prepare(`UPDATE trial_access SET tracking_status = CASE WHEN paid_tracking_enabled = 1 THEN 'active' ELSE 'trial' END, updated_at = ? WHERE student_id = ?`).run(now, row.student_id);
    } else {
      db.prepare(`UPDATE tracking_intents SET status = 'intent_submitted', updated_at = ? WHERE id = ?`).run(now, row.tracking_intent_id);
      db.prepare(`UPDATE trial_access SET tracking_status = CASE WHEN paid_tracking_enabled = 1 THEN 'active' ELSE 'intent' END, updated_at = ? WHERE student_id = ?`).run(now, row.student_id);
    }
  }

  appendAdminActionLog({
    userId: input.adminSession.userId,
    userRole: input.adminSession.role,
    actionType: "update_lead_followup",
    targetType: "lead_followup",
    targetId: input.id,
    detail: `跟进状态改成 ${input.status}${input.followUpNote ? ` / ${input.followUpNote}` : ""}${rejectionReason ? ` / ${rejectionReason}` : ""}`
  });

  const updated = db.prepare(`
    SELECT lf.*, u.name AS user_name, s.name AS student_name
    FROM lead_followups lf
    INNER JOIN users u ON u.id = lf.user_id
    INNER JOIN students s ON s.id = lf.student_id
    WHERE lf.id = ?
    LIMIT 1
  `).get(input.id) as any;
  return mapFollowup(updated);
}

export function getLeadFollowupSummary() {
  const items = listLeadFollowups();
  return {
    total: items.length,
    newIntent: items.filter((item) => item.status === "new_intent").length,
    contacted: items.filter((item) => item.status === "contacted").length,
    followUpPending: items.filter((item) => item.status === "follow_up_pending").length,
    activated: items.filter((item) => item.status === "activated").length,
    rejected: items.filter((item) => item.status === "rejected" || item.status === "not_needed").length,
    items
  };
}

export function getResultCompareTaskIdForStudent(studentId = getPrimaryStudentId()) {
  const tasks = listStudentRecheckTasks(studentId).filter((item) => item.status !== "dismissed");
  return tasks[0]?.id ?? null;
}
function resultEventLabel(eventName: ResultEventName) {
  switch (eventName) {
    case "click_continue_tracking":
      return "家长点了继续追踪";
    case "submit_tracking_intent":
      return "家长把继续追踪意向递上来了";
    case "click_asset":
      return "家长先去看推荐素材了";
    case "viewed_recheck_result_complete":
      return "家长把复检结果看完了";
    case "opened_recheck_task":
      return "家长打开了复检任务页";
    default:
      return "家长回看了一次结果页";
  }
}

function toTimelineNodes(studentId: number): EvidenceTimelineNode[] {
  const db = getDb();

  const diagnosisRows = db.prepare(`
    SELECT d.id, d.current_stage, d.repair_actions, d.parent_summary, d.recheck_summary, d.next_priority, d.continue_tracking_reason,
           d.created_at, u.upload_type, u.file_name, u.student_self_report, u.note, u.submission_type
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 6
  `).all(studentId) as Array<any>;

  const weeklyRows = db.prepare(`
    SELECT id, week_label, report_json, created_at
    FROM weekly_reports
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 3
  `).all(studentId) as Array<any>;

  const changeRows = db.prepare(`
    SELECT id, change_type, description, next_priority, next_action_type, next_recheck_reason, created_at
    FROM change_logs
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 6
  `).all(studentId) as Array<any>;

  const taskRows = db.prepare(`
    SELECT id, tag, status, trigger_reason, next_action_type, continue_tracking_reason, next_priority, updated_at
    FROM recheck_tasks
    WHERE student_id = ? AND status != 'dismissed'
    ORDER BY updated_at DESC, id DESC
    LIMIT 4
  `).all(studentId) as Array<any>;

  const eventRows = db.prepare(`
    SELECT id, diagnosis_id, event_name, event_value, created_at
    FROM result_page_events
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 6
  `).all(studentId) as Array<any>;

  const memory = getStudentMemorySummary(studentId);

  const diagnosisNodes: EvidenceTimelineNode[] = diagnosisRows.map((row) => {
    const actions = parseArray(row.repair_actions);
    return {
      id: `diagnosis-${row.id}`,
      entityId: row.id,
      kind: "diagnosis",
      title: row.submission_type === "recheck" ? "这次复检交上来了" : "这次体检交上来了",
      subtitle: `${row.upload_type ?? "题图"} · ${row.file_name}`,
      createdAt: row.created_at,
      problem: row.current_stage ?? row.student_self_report ?? "这次主要卡点还在整理。",
      action: actions[0] ?? row.note ?? "这次先给了一个最小动作。",
      result: row.recheck_summary ?? row.parent_summary ?? "这次先把结果记进档案了。",
      nextImpact: row.next_priority ?? row.continue_tracking_reason ?? "下一轮还会顺着这条线继续看。",
      href: `/diagnosis/${row.id}`
    };
  });

  const weeklyNodes: EvidenceTimelineNode[] = weeklyRows.map((row) => {
    const payload = parseObject<any>(row.report_json, {
      this_week_problem: [],
      this_week_actions: [],
      improved_points: [],
      unstable_points: [],
      repeated_error_tags: [],
      next_week_plan: [],
      student_today_action: null,
      parent_weekly_summary: null,
      recheck_status: null,
      next_priority: null,
      continue_tracking_reason: null
    });
    return {
      id: `weekly-${row.id}`,
      entityId: row.id,
      kind: "weekly_report",
      title: `这周周总结出来了` ,
      subtitle: row.week_label,
      createdAt: row.created_at,
      problem: payload.this_week_problem?.[0] ?? "这周主要问题我先做了归拢。",
      action: payload.this_week_actions?.[0] ?? payload.student_today_action ?? "这周先按最小动作推进。",
      result: payload.parent_weekly_summary ?? payload.recheck_status ?? "这周变化已经沉到周报里。",
      nextImpact: payload.next_priority ?? payload.continue_tracking_reason ?? payload.next_week_plan?.[0] ?? "下周继续顺着这条线看。",
      href: `/weekly-report/${row.id}`
    };
  });

  const changeNodes: EvidenceTimelineNode[] = changeRows.map((row) => ({
    id: `change-${row.id}`,
    entityId: row.id,
    kind: "change_log",
    title: "这次变化我已经记下来了",
    subtitle: row.change_type,
    createdAt: row.created_at,
    problem: row.description,
    action: row.next_action_type ?? row.next_recheck_reason ?? "先按这次变化继续跟。",
    result: row.description,
    nextImpact: row.next_priority ?? "下一轮会拿这条变化继续回看。",
    href: null
  }));

  const taskNodes: EvidenceTimelineNode[] = taskRows.map((row) => ({
    id: `recheck-${row.id}`,
    entityId: row.id,
    kind: "recheck_task",
    title: row.status === "stabilized" ? "这条复检先记成已稳住" : row.status === "passed_once" ? "这条有进步，但还没稳" : "这条复检继续挂着看",
    subtitle: row.tag,
    createdAt: row.updated_at,
    problem: row.trigger_reason ?? `这轮主要还是盯 ${row.tag}`,
    action: row.next_action_type ?? "再做一轮同类题。",
    result: row.continue_tracking_reason ?? "这条复检状态已经同步更新。",
    nextImpact: row.next_priority ?? "下一轮继续顺着这条线往下看。",
    href: `/recheck/${row.id}`
  }));

  const eventNodes: EvidenceTimelineNode[] = eventRows.map((row) => ({
    id: `event-${row.id}`,
    entityId: row.id,
    kind: "result_event",
    title: resultEventLabel(row.event_name as ResultEventName),
    subtitle: row.event_name,
    createdAt: row.created_at,
    problem: "这一步能看出家长当时最在意的是不是要继续往下追。",
    action: row.event_value ?? "这次没补额外备注。",
    result: resultEventLabel(row.event_name as ResultEventName),
    nextImpact: row.event_name === "submit_tracking_intent" ? "这条已经进了继续追踪漏斗。" : "这能帮我判断家长这周是不是已经愿意继续跟。",
    href: row.diagnosis_id ? `/diagnosis/${row.diagnosis_id}` : null
  }));

  const memoryNode: EvidenceTimelineNode = {
    id: `memory-${studentId}`,
    entityId: studentId,
    kind: "memory",
    title: "当前记忆摘要",
    subtitle: "这是我现在给这位孩子留的长期记忆",
    createdAt: memory.updated_at,
    problem: memory.repeated_error_tags[0] ?? "当前重复错因还在继续观察。",
    action: memory.next_action_type || "下一轮先按最小动作继续做。",
    result: memory.last_best_improvement || "这轮先把最近变化记住了。",
    nextImpact: memory.next_priority,
    href: null
  };

  return [...diagnosisNodes, ...weeklyNodes, ...changeNodes, ...taskNodes, ...eventNodes, memoryNode]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 14);
}

export function getEvidenceTimelineDetail(studentId = getPrimaryStudentId()): EvidenceTimelineDetail | null {
  ensureA4Schema();
  const db = getDb();
  const student = db.prepare(`SELECT id, name FROM students WHERE id = ? LIMIT 1`).get(studentId) as { id: number; name: string } | undefined;
  if (!student) return null;

  const latestDiagnosis = db.prepare(`
    SELECT d.id, d.current_stage, d.recheck_summary, d.next_priority, d.continue_tracking_reason, d.problem_tags, d.recheck_task_id, d.created_at
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  `).get(studentId) as any;

  const latestWeekly = db.prepare(`
    SELECT id, report_json, created_at
    FROM weekly_reports
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(studentId) as any;

  const latestChange = db.prepare(`
    SELECT id, description, created_at
    FROM change_logs
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(studentId) as any;

  const latestEvents = db.prepare(`
    SELECT event_name, event_value
    FROM result_page_events
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 4
  `).all(studentId) as Array<{ event_name: ResultEventName; event_value: string | null }>;

  const memory = getStudentMemorySummary(studentId);
  const weeklyPayload = parseObject(latestWeekly?.report_json ?? null, {
    improved_points: [],
    unstable_points: [],
    next_priority: null,
    continue_tracking_reason: null,
    parent_weekly_summary: null,
    repeated_error_tags: [],
    next_week_plan: []
  } as any);
  const activeTaskId = latestDiagnosis?.recheck_task_id ?? getResultCompareTaskIdForStudent(studentId);

  return {
    studentId: student.id,
    studentName: student.name,
    lastProblemSummary: latestDiagnosis?.current_stage ?? weeklyPayload.this_week_problem?.[0] ?? memory.repeated_error_tags[0] ?? "上次主要问题我还在等新材料。",
    currentChangeSummary: latestChange?.description ?? weeklyPayload.parent_weekly_summary ?? memory.last_best_improvement ?? "这轮变化我还在继续攒证据。",
    stabilizedItems: unique([...(weeklyPayload.improved_points ?? []), ...memory.stable_tags], 4),
    unstableItems: unique([...(weeklyPayload.unstable_points ?? []), ...memory.repeated_error_tags], 4),
    nextPriority: latestDiagnosis?.next_priority ?? weeklyPayload.next_priority ?? memory.next_priority,
    continueTrackingReason: latestDiagnosis?.continue_tracking_reason ?? weeklyPayload.continue_tracking_reason ?? memory.next_recheck_reason,
    latestDiagnosisId: latestDiagnosis?.id ?? null,
    latestWeeklyReportId: latestWeekly?.id ?? null,
    priorityRecheckTaskId: activeTaskId ?? null,
    recentEventSummary: latestEvents.map((item) => item.event_value ? `${resultEventLabel(item.event_name)}：${item.event_value}` : resultEventLabel(item.event_name)),
    nodes: toTimelineNodes(studentId)
  };
}


