import { getDb, getReviewQueue } from "@/lib/db";
import { ensureProductSchema, getSkillAssets, getStudentMemorySummary } from "@/lib/db/product";
import type {
  AdminActionLog,
  AdminOperationsSnapshot,
  AdminStudentRow,
  AdminTrialAccessItem,
  ModelCallLogDetail,
  SkillAsset,
  StudentOption,
  Subject
} from "@/lib/types";

function parseArray(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function parseReviewStatus(value: string | null) {
  return value === "pending" || value === "approved" || value === "rejected" || value === "edited"
    ? value
    : null;
}

export function ensureAdminSchema() {
  ensureProductSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const admin = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as { id: number } | undefined;
  if (!admin) {
    db.prepare(`INSERT INTO users (name, email, password, role, created_at, phone) VALUES (?, ?, ?, 'admin', ?, ?)`)
      .run("管理员演示账号", "admin@example.com", "demo123", new Date().toISOString(), "13800009999");
  }
}

export function appendAdminActionLog(input: {
  userId: number;
  userRole: string;
  actionType: string;
  targetType: string;
  targetId?: number | null;
  detail: string;
}) {
  ensureAdminSchema();
  const db = getDb();
  db.prepare(`
    INSERT INTO admin_action_logs (user_id, user_role, action_type, target_type, target_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.userId, input.userRole, input.actionType, input.targetType, input.targetId ?? null, input.detail, new Date().toISOString());
}

export function listAdminActionLogs(limit = 12) {
  ensureAdminSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT aal.id, aal.user_role, aal.action_type, aal.target_type, aal.target_id, aal.detail, aal.created_at, u.name AS actor_name
    FROM admin_action_logs aal
    INNER JOIN users u ON u.id = aal.user_id
    ORDER BY aal.created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    user_role: string;
    action_type: string;
    target_type: string;
    target_id: number | null;
    detail: string;
    created_at: string;
    actor_name: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    actorName: row.actor_name,
    actorRole: row.user_role,
    actionType: row.action_type,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    createdAt: row.created_at
  })) satisfies AdminActionLog[];
}

export function listStudentsForUser(userId: number) {
  ensureAdminSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.id, s.user_id, s.name, s.grade, s.school, sm.next_priority
    FROM students s
    LEFT JOIN student_memory sm ON sm.student_id = s.id
    WHERE s.user_id = ?
    ORDER BY s.created_at ASC, s.id ASC
  `).all(userId) as Array<{ id: number; user_id: number; name: string; grade: string | null; school: string | null; next_priority: string | null }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    grade: row.grade,
    school: row.school,
    nextPriority: row.next_priority
  })) satisfies StudentOption[];
}

export function listTrialAccessAdmin() {
  ensureAdminSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT ta.id, ta.user_id, ta.student_id, ta.phone, ta.invite_code, ta.whitelist_enabled, ta.free_trial_total, ta.free_trial_used, ta.max_images_per_upload, ta.enabled_grades, ta.enabled_subjects, ta.paid_tracking_enabled, ta.tracking_status, u.name AS user_name, s.name AS student_name, s.grade
    FROM trial_access ta
    INNER JOIN users u ON u.id = ta.user_id
    INNER JOIN students s ON s.id = ta.student_id
    ORDER BY u.id ASC, s.id ASC
  `).all() as Array<{
    id: number;
    user_id: number;
    student_id: number;
    phone: string | null;
    invite_code: string | null;
    whitelist_enabled: number;
    free_trial_total: number;
    free_trial_used: number;
    max_images_per_upload: number;
    enabled_grades: string;
    enabled_subjects: string;
    paid_tracking_enabled: number;
    tracking_status: string | null;
    user_name: string;
    student_name: string;
    grade: string | null;
  }>;

  return rows.map((row) => {
    const enabledSubjects = parseArray(row.enabled_subjects).filter((item): item is Subject => item === "math" || item === "english");
    const enabledGrades = parseArray(row.enabled_grades);
    return {
      id: row.id,
      userId: row.user_id,
      studentId: row.student_id,
      userName: row.user_name,
      studentName: row.student_name,
      grade: row.grade,
      phone: row.phone,
      inviteCode: row.invite_code,
      whitelistEnabled: Boolean(row.whitelist_enabled),
      freeTrialTotal: row.free_trial_total,
      freeTrialUsed: row.free_trial_used,
      freeTrialRemaining: Math.max(0, row.free_trial_total - row.free_trial_used),
      maxImagesPerUpload: row.max_images_per_upload,
      enabledGrades,
      enabledSubjects,
      gradeOpen: enabledGrades.length === 0 || enabledGrades.includes(row.grade ?? ""),
      paidTrackingEnabled: Boolean(row.paid_tracking_enabled),
      trackingStatus: (row.tracking_status as any) ?? (row.paid_tracking_enabled ? "active" : "trial"),
      subjectOpenMap: {
        math: enabledSubjects.includes("math"),
        english: enabledSubjects.includes("english")
      }
    } satisfies AdminTrialAccessItem;
  });
}

export function updateTrialAccessAdmin(id: number, input: {
  whitelistEnabled: boolean;
  freeTrialTotal: number;
  freeTrialUsed: number;
  maxImagesPerUpload: number;
  enabledGrades: string[];
  enabledSubjects: Subject[];
  trackingStatus?: string;
  paidTrackingEnabled?: boolean;
}) {
  ensureAdminSchema();
  const db = getDb();
  db.prepare(`
    UPDATE trial_access
    SET whitelist_enabled = ?,
        free_trial_total = ?,
        free_trial_used = ?,
        max_images_per_upload = ?,
        enabled_grades = ?,
        enabled_subjects = ?,
        tracking_status = COALESCE(?, tracking_status),
        paid_tracking_enabled = COALESCE(?, paid_tracking_enabled),
        updated_at = ?
    WHERE id = ?
  `).run(
    input.whitelistEnabled ? 1 : 0,
    input.freeTrialTotal,
    input.freeTrialUsed,
    input.maxImagesPerUpload,
    JSON.stringify(input.enabledGrades),
    JSON.stringify(input.enabledSubjects),
    input.trackingStatus ?? null,
    typeof input.paidTrackingEnabled === "boolean" ? (input.paidTrackingEnabled ? 1 : 0) : null,
    new Date().toISOString(),
    id
  );
}

export function listAdminStudents() {
  ensureAdminSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      s.id AS student_id,
      s.name AS student_name,
      s.grade,
      s.school,
      u.name AS parent_name,
      u.email AS parent_email,
      (
        SELECT printf('%s / %s', uploads.subject, uploads.module)
        FROM uploads
        WHERE uploads.student_id = s.id
        ORDER BY uploads.created_at DESC
        LIMIT 1
      ) AS latest_upload_label,
      (
        SELECT uploads.created_at
        FROM uploads
        WHERE uploads.student_id = s.id
        ORDER BY uploads.created_at DESC
        LIMIT 1
      ) AS latest_upload_at,
      (
        SELECT d.id
        FROM diagnoses d
        INNER JOIN uploads u2 ON u2.id = d.upload_id
        WHERE u2.student_id = s.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) AS latest_diagnosis_id,
      (
        SELECT d.current_stage
        FROM diagnoses d
        INNER JOIN uploads u2 ON u2.id = d.upload_id
        WHERE u2.student_id = s.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) AS latest_diagnosis_stage,
      (
        SELECT d.review_status
        FROM diagnoses d
        INNER JOIN uploads u2 ON u2.id = d.upload_id
        WHERE u2.student_id = s.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) AS latest_diagnosis_status,
      (
        SELECT d.created_at
        FROM diagnoses d
        INNER JOIN uploads u2 ON u2.id = d.upload_id
        WHERE u2.student_id = s.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) AS latest_diagnosis_at,
      (
        SELECT wr.id
        FROM weekly_reports wr
        WHERE wr.student_id = s.id
        ORDER BY wr.created_at DESC
        LIMIT 1
      ) AS latest_weekly_report_id,
      sm.repeated_error_tags,
      sm.next_priority
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN student_memory sm ON sm.student_id = s.id
    ORDER BY u.id ASC, s.id ASC
  `).all() as Array<{
    student_id: number;
    student_name: string;
    grade: string | null;
    school: string | null;
    parent_name: string;
    parent_email: string;
    latest_upload_label: string | null;
    latest_upload_at: string | null;
    latest_diagnosis_id: number | null;
    latest_diagnosis_stage: string | null;
    latest_diagnosis_status: string | null;
    latest_diagnosis_at: string | null;
    latest_weekly_report_id: number | null;
    repeated_error_tags: string | null;
    next_priority: string | null;
  }>;

  return rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    grade: row.grade,
    school: row.school,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    latestUploadLabel: row.latest_upload_label,
    latestUploadAt: row.latest_upload_at,
    latestDiagnosisId: row.latest_diagnosis_id,
    latestDiagnosisStage: row.latest_diagnosis_stage,
    latestDiagnosisStatus: parseReviewStatus(row.latest_diagnosis_status),
    latestDiagnosisAt: row.latest_diagnosis_at,
    latestWeeklyReportId: row.latest_weekly_report_id,
    recentMemoryTags: parseArray(row.repeated_error_tags).slice(0, 3),
    nextPriority: row.next_priority
  })) satisfies AdminStudentRow[];
}

function mapModelCallRows(rows: Array<any>) {
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    uploadId: row.upload_id,
    provider: row.provider,
    modelName: row.model_name,
    diagnosisMode: row.diagnosis_mode,
    promptVersion: row.prompt_version,
    inputSize: row.input_size,
    outputSize: row.output_size,
    estimatedCost: row.estimated_cost,
    latencyMs: row.latency_ms,
    success: Boolean(row.success),
    errorCode: row.error_code,
    retryCount: row.retry_count,
    createdAt: row.created_at
  })) satisfies ModelCallLogDetail[];
}

export function getAdminOperationsSnapshot() {
  ensureAdminSchema();
  const db = getDb();
  const totals = db.prepare(`
    SELECT COUNT(*) AS total_calls,
           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_calls,
           COALESCE(SUM(estimated_cost), 0) AS estimated_cost,
           COALESCE(AVG(latency_ms), 0) AS avg_latency
    FROM model_call_logs
  `).get() as { total_calls: number; failed_calls: number | null; estimated_cost: number; avg_latency: number };

  const latestCalls = mapModelCallRows(db.prepare(`SELECT * FROM model_call_logs ORDER BY created_at DESC LIMIT 12`).all() as Array<any>);
  const latestFailures = mapModelCallRows(db.prepare(`SELECT * FROM model_call_logs WHERE success = 0 ORDER BY created_at DESC LIMIT 8`).all() as Array<any>);
  const latestActions = listAdminActionLogs();

  return {
    totalCalls: totals.total_calls,
    failedCalls: totals.failed_calls ?? 0,
    estimatedCost: Number(totals.estimated_cost ?? 0),
    averageLatencyMs: Math.round(Number(totals.avg_latency ?? 0)),
    latestFailures,
    latestCalls,
    latestActions
  } satisfies AdminOperationsSnapshot;
}

export function getAdminOverview() {
  ensureAdminSchema();
  const db = getDb();
  const students = (db.prepare(`SELECT COUNT(*) AS count FROM students`).get() as { count: number }).count;
  const trialOpen = (db.prepare(`SELECT COUNT(*) AS count FROM trial_access WHERE whitelist_enabled = 1`).get() as { count: number }).count;
  const assets = (db.prepare(`SELECT COUNT(*) AS count FROM skill_assets`).get() as { count: number }).count;
  const pendingReviews = getReviewQueue().filter((item) => item.reviewStatus === "pending" || item.reviewStatus === "edited").length;
  return { students, trialOpen, assets, pendingReviews };
}

export function listSkillAssetsAdmin() {
  ensureAdminSchema();
  return getSkillAssets();
}

export function createSkillAssetAdmin(input: Omit<SkillAsset, "id">) {
  ensureAdminSchema();
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO skill_assets (subject, module, tag, difficulty, asset_type, title, summary, file_url, preview_url, use_stage, paid_only, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.subject,
    input.module,
    input.tag,
    input.difficulty,
    input.assetType,
    input.title,
    input.summary,
    input.fileUrl,
    input.previewUrl,
    input.useStage,
    input.paidOnly ? 1 : 0,
    new Date().toISOString()
  );
  return Number(result.lastInsertRowid);
}

export function updateSkillAssetAdmin(id: number, input: Omit<SkillAsset, "id">) {
  ensureAdminSchema();
  const db = getDb();
  db.prepare(`
    UPDATE skill_assets
    SET subject = ?, module = ?, tag = ?, difficulty = ?, asset_type = ?, title = ?, summary = ?, file_url = ?, preview_url = ?, use_stage = ?, paid_only = ?
    WHERE id = ?
  `).run(
    input.subject,
    input.module,
    input.tag,
    input.difficulty,
    input.assetType,
    input.title,
    input.summary,
    input.fileUrl,
    input.previewUrl,
    input.useStage,
    input.paidOnly ? 1 : 0,
    id
  );
}

export function deleteSkillAssetAdmin(id: number) {
  ensureAdminSchema();
  const db = getDb();
  db.prepare(`DELETE FROM skill_assets WHERE id = ?`).run(id);
}

export function getReviewAndCostSummaryText() {
  const ops = getAdminOperationsSnapshot();
  return {
    reviewCount: getReviewQueue().length,
    failedCount: ops.failedCalls,
    estimatedCost: ops.estimatedCost
  };
}

export function getStudentMemoryPreview(studentId: number) {
  return getStudentMemorySummary(studentId);
}
