import { getDb, getLatestWeeklyReport, getPrimaryStudentId } from "@/lib/db";
import { appendAdminActionLog, ensureAdminSchema } from "@/lib/db/admin";
import { ensureP25Schema, runWeeklyBatchForAllStudents } from "@/lib/db/p25";
import { getRecommendedSkillAssetByDiagnosis } from "@/lib/db/product";
import { listStudentRecheckTasks } from "@/lib/db/recheck";
import type {
  AppSession,
  LeadFollowupDetail,
  LeadFollowupStatus,
  ResultCompareDetail,
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
