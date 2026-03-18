import {
  createDiagnosisRecord,
  createRepairTasks,
  createUploadRecord,
  getDb,
  upsertWeeklyReport
} from "@/lib/db";
import { appendAdminActionLog, ensureAdminSchema } from "@/lib/db/admin";
import { ensureHeartbeatSchema, syncHeartbeatForStudent } from "@/lib/db/heartbeat";
import {
  appendStructuredChangeLog,
  consumeTrialAccessUsage,
  ensureProductSchema,
  enrichDiagnosisRecord,
  recordUploadMeta,
  upsertStudentMemorySummary
} from "@/lib/db/product";
import {
  decorateWeeklyPayload,
  ensureP25Schema,
  persistWeeklyReportArtifacts,
  recordSubmissionMeta
} from "@/lib/db/p25";
import { attachWeeklyReportToRecheckTasks, syncRecheckForDiagnosis } from "@/lib/db/recheck";
import { validateMembershipCapability } from "@/lib/db/membership";
import { generateWeeklyReport } from "@/lib/services/ai";
import { rewriteDiagnosisForChenTeacher } from "@/lib/services/tone-chen";
import type {
  AppSession,
  DiagnosisMode,
  DiagnosisPayload,
  ReviewDraftDetail,
  ReviewQueueItem,
  ReviewStatus,
  StepQuality,
  StuckPointSource,
  SubmissionType,
  Subject
} from "@/lib/types";

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function parseObject<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function diffPayload(previous: DiagnosisPayload, next: DiagnosisPayload) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(next) as Array<keyof DiagnosisPayload>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      diff[key] = { from: previous[key], to: next[key] };
    }
  }
  return diff;
}

function queueOrderSql() {
  return `
    CASE rd.review_status
      WHEN 'pending' THEN 0
      WHEN 'edited' THEN 1
      WHEN 'approved' THEN 2
      ELSE 3
    END,
    datetime(rd.updated_at) DESC,
    rd.id DESC
  `;
}

export function ensureD1Schema() {
  ensureProductSchema();
  ensureP25Schema();
  ensureAdminSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS review_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      parent_account_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      submission_type TEXT NOT NULL DEFAULT 'diagnosis',
      source_recheck_task_id INTEGER,
      upload_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      score_note TEXT,
      note TEXT,
      student_self_report TEXT,
      stuck_point_choice TEXT,
      stuck_point_source TEXT NOT NULL DEFAULT 'ai_inferred',
      steps_text TEXT,
      has_steps INTEGER NOT NULL DEFAULT 0,
      step_quality TEXT NOT NULL DEFAULT 'none',
      image_count INTEGER NOT NULL DEFAULT 1,
      diagnosis_mode TEXT NOT NULL DEFAULT 'standard',
      confidence REAL NOT NULL DEFAULT 0,
      draft_payload_json TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      review_notes TEXT,
      review_diff_json TEXT,
      official_upload_id INTEGER,
      official_diagnosis_id INTEGER,
      official_weekly_report_id INTEGER,
      materialized_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (parent_account_id) REFERENCES users(id),
      FOREIGN KEY (source_recheck_task_id) REFERENCES recheck_tasks(id),
      FOREIGN KEY (official_upload_id) REFERENCES uploads(id),
      FOREIGN KEY (official_diagnosis_id) REFERENCES diagnoses(id),
      FOREIGN KEY (official_weekly_report_id) REFERENCES weekly_reports(id)
    );

    CREATE INDEX IF NOT EXISTS idx_review_drafts_student_status
      ON review_drafts (student_id, review_status, updated_at);

    CREATE INDEX IF NOT EXISTS idx_review_drafts_parent_status
      ON review_drafts (parent_account_id, review_status, updated_at);
  `);
}

function getParentAccountIdByStudent(studentId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT user_id FROM students WHERE id = ? LIMIT 1`).get(studentId) as { user_id: number } | undefined;
  if (!row) {
    throw new Error(`student_not_found:${studentId}`);
  }
  return row.user_id;
}

function mapDraftRow(row: {
  id: number;
  student_id: number;
  parent_account_id: number;
  student_name: string;
  parent_name: string;
  parent_email: string;
  subject: Subject;
  module: string;
  review_status: ReviewStatus;
  confidence: number;
  created_at: string;
  updated_at: string;
  upload_type: string;
  file_name: string;
  file_path: string;
  score_note: string | null;
  note: string | null;
  student_self_report: string | null;
  stuck_point_choice: string | null;
  stuck_point_source: StuckPointSource | null;
  steps_text: string | null;
  has_steps: number;
  step_quality: StepQuality | null;
  image_count: number;
  diagnosis_mode: DiagnosisMode | null;
  draft_payload_json: string;
  review_notes: string | null;
  review_diff_json: string | null;
  official_upload_id: number | null;
  official_diagnosis_id: number | null;
  official_weekly_report_id: number | null;
  materialized_at: string | null;
  submission_type: SubmissionType | null;
  source_recheck_task_id: number | null;
}): ReviewDraftDetail {
  const fallbackPayload: DiagnosisPayload = {
    current_stage: "这条草稿还在待审核",
    subject: row.subject,
    module: row.module,
    problem_tags: [],
    repair_actions: [],
    parent_summary: "这条草稿还在待审核，暂时还没正式入档。",
    confidence: row.confidence,
    review_status: row.review_status
  };
  return {
    id: row.id,
    studentId: row.student_id,
    parentAccountId: row.parent_account_id,
    studentName: row.student_name,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    subject: row.subject,
    module: row.module,
    reviewStatus: row.review_status,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    uploadType: row.upload_type,
    fileName: row.file_name,
    filePath: row.file_path,
    scoreNote: row.score_note,
    note: row.note,
    studentSelfReport: row.student_self_report,
    stuckPointChoice: row.stuck_point_choice,
    stuckPointSource: (row.stuck_point_source ?? "ai_inferred") as StuckPointSource,
    stepsText: row.steps_text,
    hasSteps: Boolean(row.has_steps),
    stepQuality: (row.step_quality ?? "none") as StepQuality,
    imageCount: Number(row.image_count ?? 1),
    diagnosisMode: (row.diagnosis_mode ?? "standard") as DiagnosisMode,
    submissionType: (row.submission_type ?? "diagnosis") as SubmissionType,
    sourceRecheckTaskId: row.source_recheck_task_id,
    payload: parseObject<DiagnosisPayload>(row.draft_payload_json, fallbackPayload),
    reviewNotes: row.review_notes,
    reviewDiff: parseObject<Record<string, unknown> | null>(row.review_diff_json, null),
    officialUploadId: row.official_upload_id,
    officialDiagnosisId: row.official_diagnosis_id,
    officialWeeklyReportId: row.official_weekly_report_id,
    materializedAt: row.materialized_at
  };
}

export function createReviewDraft(input: {
  studentId: number;
  subject: Subject;
  module: string;
  submissionType: SubmissionType;
  sourceRecheckTaskId?: number | null;
  uploadType: string;
  fileName: string;
  filePath: string;
  scoreNote?: string | null;
  note?: string | null;
  studentSelfReport?: string | null;
  stuckPointChoice?: string | null;
  stuckPointSource: StuckPointSource;
  stepsText?: string | null;
  hasSteps: boolean;
  stepQuality: StepQuality;
  imageCount: number;
  diagnosisMode: DiagnosisMode;
  payload: DiagnosisPayload;
}) {
  ensureD1Schema();
  const db = getDb();
  const now = new Date().toISOString();
  const parentAccountId = getParentAccountIdByStudent(input.studentId);
  const result = db.prepare(`
    INSERT INTO review_drafts (
      student_id, parent_account_id, subject, module, submission_type, source_recheck_task_id,
      upload_type, file_name, file_path, score_note, note, student_self_report,
      stuck_point_choice, stuck_point_source, steps_text, has_steps, step_quality,
      image_count, diagnosis_mode, confidence, draft_payload_json, review_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    input.studentId,
    parentAccountId,
    input.subject,
    input.module,
    input.submissionType,
    input.sourceRecheckTaskId ?? null,
    input.uploadType,
    input.fileName,
    input.filePath,
    input.scoreNote ?? null,
    input.note ?? null,
    input.studentSelfReport ?? null,
    input.stuckPointChoice ?? null,
    input.stuckPointSource,
    input.stepsText ?? null,
    input.hasSteps ? 1 : 0,
    input.stepQuality,
    input.imageCount,
    input.diagnosisMode,
    input.payload.confidence,
    stringify(input.payload),
    now,
    now
  );

  consumeTrialAccessUsage(input.studentId);
  return Number(result.lastInsertRowid);
}

export function getReviewQueue(): ReviewQueueItem[] {
  ensureD1Schema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT rd.*, s.name AS student_name, u.name AS parent_name, u.email AS parent_email
    FROM review_drafts rd
    INNER JOIN students s ON s.id = rd.student_id
    INNER JOIN users u ON u.id = rd.parent_account_id
    ORDER BY ${queueOrderSql()}
  `).all() as Array<any>;

  return rows.map((row) => {
    const detail = mapDraftRow(row);
    return {
      id: detail.id,
      studentId: detail.studentId,
      parentAccountId: detail.parentAccountId,
      studentName: detail.studentName,
      parentName: detail.parentName,
      parentEmail: detail.parentEmail,
      subject: detail.subject,
      module: detail.module,
      reviewStatus: detail.reviewStatus,
      confidence: detail.confidence,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      payload: detail.payload,
      reviewNotes: detail.reviewNotes,
      officialDiagnosisId: detail.officialDiagnosisId,
      officialWeeklyReportId: detail.officialWeeklyReportId
    } satisfies ReviewQueueItem;
  });
}

export function getReviewDraftDetail(id: number) {
  ensureD1Schema();
  const db = getDb();
  const row = db.prepare(`
    SELECT rd.*, s.name AS student_name, u.name AS parent_name, u.email AS parent_email
    FROM review_drafts rd
    INNER JOIN students s ON s.id = rd.student_id
    INNER JOIN users u ON u.id = rd.parent_account_id
    WHERE rd.id = ?
    LIMIT 1
  `).get(id) as any;
  return row ? mapDraftRow(row) : null;
}

export function updateReviewDraft(input: {
  draftId: number;
  payload: DiagnosisPayload;
  reviewStatus: ReviewStatus;
  reviewNotes?: string | null;
}) {
  ensureD1Schema();
  const db = getDb();
  const current = getReviewDraftDetail(input.draftId);
  if (!current) {
    return null;
  }

  const nextPayload = { ...input.payload, review_status: input.reviewStatus } satisfies DiagnosisPayload;
  const reviewDiff = diffPayload(current.payload, nextPayload);
  db.prepare(`
    UPDATE review_drafts
    SET subject = ?,
        module = ?,
        confidence = ?,
        draft_payload_json = ?,
        review_status = ?,
        review_notes = ?,
        review_diff_json = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextPayload.subject,
    nextPayload.module,
    nextPayload.confidence,
    stringify(nextPayload),
    input.reviewStatus,
    input.reviewNotes ?? null,
    stringify(reviewDiff),
    new Date().toISOString(),
    input.draftId
  );

  return {
    detail: getReviewDraftDetail(input.draftId),
    reviewDiff
  };
}

function logReviewAudit(session: AppSession, actionType: string, draftId: number, detail: string) {
  appendAdminActionLog({
    userId: session.userId,
    userRole: session.role,
    actionType,
    targetType: "review_draft",
    targetId: draftId,
    detail
  });
}

export async function approveReviewDraft(input: {
  draftId: number;
  payload: DiagnosisPayload;
  reviewNotes?: string | null;
  adminSession: AppSession;
}) {
  ensureD1Schema();
  ensureHeartbeatSchema();
  const db = getDb();
  const draft = getReviewDraftDetail(input.draftId);
  if (!draft) {
    throw new Error("review_draft_not_found");
  }

  if (draft.officialDiagnosisId) {
    logReviewAudit(input.adminSession, "approve_review_draft", draft.id, `重复确认草稿，沿用正式 diagnosis ${draft.officialDiagnosisId}`);
    return {
      officialDiagnosisId: draft.officialDiagnosisId,
      officialWeeklyReportId: draft.officialWeeklyReportId,
      recheckTaskId: null,
      reviewDiff: draft.reviewDiff ?? {}
    };
  }

  const approvedPayload = rewriteDiagnosisForChenTeacher({
    ...input.payload,
    subject: draft.subject,
    module: input.payload.module,
    review_status: "approved"
  });
  const reviewDiff = diffPayload(draft.payload, approvedPayload);

  const materialized = db.transaction(() => {
    const uploadId = createUploadRecord({
      studentId: draft.studentId,
      subject: approvedPayload.subject,
      module: approvedPayload.module,
      scoreNote: draft.scoreNote,
      note: draft.note,
      studentSelfReport: draft.studentSelfReport,
      uploadType: draft.uploadType,
      fileName: draft.fileName,
      filePath: draft.filePath
    });

    recordUploadMeta(uploadId, {
      stuckPointChoice: draft.stuckPointChoice,
      stuckPointSource: draft.stuckPointSource,
      stepsText: draft.stepsText,
      hasSteps: draft.hasSteps,
      stepQuality: draft.stepQuality,
      imageCount: draft.imageCount,
      diagnosisMode: draft.diagnosisMode,
      skipTrialUsageIncrement: true
    });
    recordSubmissionMeta(uploadId, {
      submissionType: draft.submissionType,
      recheckTaskId: draft.sourceRecheckTaskId
    });

    const diagnosisId = createDiagnosisRecord(uploadId, approvedPayload);
    enrichDiagnosisRecord(diagnosisId, {
      draftDiagnosis: draft.payload,
      approvedDiagnosis: approvedPayload,
      diagnosisMode: draft.diagnosisMode,
      promptVersion: draft.submissionType === "recheck" ? "diag-recheck-v1" : "diag-v5",
      reviewNotes: input.reviewNotes ?? null,
      reviewDiff
    });
    createRepairTasks(diagnosisId, draft.studentId, approvedPayload.subject, approvedPayload.module, approvedPayload.repair_actions);

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE review_drafts
      SET subject = ?,
          module = ?,
          confidence = ?,
          draft_payload_json = ?,
          review_status = 'approved',
          review_notes = ?,
          review_diff_json = ?,
          official_upload_id = ?,
          official_diagnosis_id = ?,
          materialized_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      approvedPayload.subject,
      approvedPayload.module,
      approvedPayload.confidence,
      stringify(approvedPayload),
      input.reviewNotes ?? null,
      stringify(reviewDiff),
      uploadId,
      diagnosisId,
      now,
      now,
      draft.id
    );

    return { uploadId, diagnosisId };
  })();

  appendStructuredChangeLog({
    studentId: draft.studentId,
    subject: approvedPayload.subject,
    module: approvedPayload.module,
    changeType: "approved",
    description: draft.submissionType === "recheck"
      ? `这条复检草稿已经审核通过，正式结果按老师确认版入档。`
      : `这条自动抓取草稿已经审核通过，正式诊断按老师确认版入档。`,
    relatedDiagnosisId: materialized.diagnosisId,
    newIssues: approvedPayload.problem_tags,
    unstableIssues: [approvedPayload.current_stage],
    repeatedErrorTags: approvedPayload.problem_tags.slice(0, 3),
    evidenceSummary: input.reviewNotes ?? approvedPayload.parent_summary
  });

  const canUseContinuousRecheck = validateMembershipCapability(draft.studentId, "continuous_recheck").ok;
  const recheck = canUseContinuousRecheck ? syncRecheckForDiagnosis(materialized.diagnosisId) : { task: null };
  if (recheck.task) {
    appendStructuredChangeLog({
      studentId: draft.studentId,
      subject: approvedPayload.subject,
      module: approvedPayload.module,
      changeType: recheck.task.stabilized ? "stabilized" : "recheck_progress",
      description: recheck.recheckSummary,
      relatedDiagnosisId: materialized.diagnosisId,
      stabilizedIssues: recheck.task.stabilized ? [recheck.task.tag] : [],
      unstableIssues: recheck.task.stabilized ? [] : [recheck.task.tag],
      repeatedErrorTags: [recheck.task.tag],
      evidenceSummary: recheck.continueTrackingReason,
      recheckTaskId: recheck.task.id,
      repeatCount7d: recheck.task.repeatCount7d,
      repeatCount30d: recheck.task.repeatCount30d,
      lastSeenAt: recheck.task.lastSeenAt,
      lastRecheckAt: recheck.task.lastRecheckAt,
      stabilizedScore: recheck.task.stabilizedScore,
      nextPriority: recheck.nextPriority,
      nextRecheckReason: recheck.nextRecheckReason,
      nextActionType: recheck.nextActionType,
      stabilized: recheck.task.stabilized
    });
  }

  let weeklyReportId: number | null = null;
  if (validateMembershipCapability(draft.studentId, "weekly_report").ok) {
    const weeklyBase = await generateWeeklyReport(draft.studentId);
    const weekly = decorateWeeklyPayload(draft.studentId, weeklyBase, "instant");
    weeklyReportId = upsertWeeklyReport(draft.studentId, weekly.payload);
    persistWeeklyReportArtifacts({
      reportId: weeklyReportId,
      mode: "instant",
      studentReportJson: weekly.studentReportJson,
      continueTrackingRecommended: weekly.continueTrackingRecommended,
      batchGeneratedAt: null
    });
    attachWeeklyReportToRecheckTasks(draft.studentId, weeklyReportId);
    upsertStudentMemorySummary(draft.studentId);
    db.prepare(`UPDATE review_drafts SET official_weekly_report_id = ?, updated_at = ? WHERE id = ?`)
      .run(weeklyReportId, new Date().toISOString(), draft.id);
  }

  syncHeartbeatForStudent(draft.studentId, draft.submissionType === "recheck" ? "review_update" : "upload_diagnosis");
  logReviewAudit(
    input.adminSession,
    "approve_review_draft",
    draft.id,
    `审核通过并正式入库：student=${draft.studentId} diagnosis=${materialized.diagnosisId} weekly=${weeklyReportId ?? "-"}`
  );

  return {
    officialDiagnosisId: materialized.diagnosisId,
    officialWeeklyReportId: weeklyReportId,
    recheckTaskId: recheck.task?.id ?? null,
    reviewDiff
  };
}

