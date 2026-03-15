import { DEFAULT_WEEKLY_REPORT, SKILL_ASSET_SEEDS } from "@/lib/mock-data";
import { getDb, getPrimaryStudentId, getStudentDiagnoses } from "@/lib/db";
import { rewriteMemorySummaryForChenTeacher } from "@/lib/services/tone-chen";
import type {
  DiagnosisDetail,
  DiagnosisMode,
  DiagnosisPayload,
  MemorySummary,
  ModelCallLogDetail,
  ResultEventName,
  ReviewStatus,
  SkillAsset,
  StepQuality,
  StuckPointSource,
  Subject,
  TrialAccessSnapshot
} from "@/lib/types";

function getPrimaryUserId() {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).get() as { id: number };
  return row.id;
}

function stringify(value: unknown) {
  return JSON.stringify(value);
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

function ensureColumn(table: string, columnName: string, definition: string) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export function ensureProductSchema() {
  const db = getDb();

  ensureColumn("users", "phone", "phone TEXT");
  ensureColumn("uploads", "stuck_point_choice", "stuck_point_choice TEXT");
  ensureColumn("uploads", "stuck_point_source", "stuck_point_source TEXT DEFAULT 'parent_selected'");
  ensureColumn("uploads", "steps_text", "steps_text TEXT");
  ensureColumn("uploads", "has_steps", "has_steps INTEGER DEFAULT 0");
  ensureColumn("uploads", "step_quality", "step_quality TEXT DEFAULT 'none'");
  ensureColumn("uploads", "image_count", "image_count INTEGER DEFAULT 1");
  ensureColumn("uploads", "diagnosis_mode", "diagnosis_mode TEXT DEFAULT 'standard'");
  ensureColumn("diagnoses", "draft_diagnosis", "draft_diagnosis TEXT");
  ensureColumn("diagnoses", "approved_diagnosis", "approved_diagnosis TEXT");
  ensureColumn("diagnoses", "review_notes", "review_notes TEXT");
  ensureColumn("diagnoses", "review_diff", "review_diff TEXT");
  ensureColumn("diagnoses", "diagnosis_mode", "diagnosis_mode TEXT DEFAULT 'standard'");
  ensureColumn("diagnoses", "prompt_version", "prompt_version TEXT DEFAULT 'diag-v4'");
  ensureColumn("change_logs", "new_issues", "new_issues TEXT DEFAULT '[]'");
  ensureColumn("change_logs", "stabilized_issues", "stabilized_issues TEXT DEFAULT '[]'");
  ensureColumn("change_logs", "unstable_issues", "unstable_issues TEXT DEFAULT '[]'");
  ensureColumn("change_logs", "repeated_error_tags", "repeated_error_tags TEXT DEFAULT '[]'");
  ensureColumn("change_logs", "evidence_summary", "evidence_summary TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS trial_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      student_id INTEGER NOT NULL UNIQUE,
      phone TEXT,
      invite_code TEXT,
      whitelist_enabled INTEGER NOT NULL DEFAULT 1,
      free_trial_total INTEGER NOT NULL DEFAULT 6,
      free_trial_used INTEGER NOT NULL DEFAULT 0,
      max_images_per_upload INTEGER NOT NULL DEFAULT 1,
      enabled_grades TEXT NOT NULL DEFAULT '["七年级","八年级"]',
      enabled_subjects TEXT NOT NULL DEFAULT '["math","english"]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      stable_tags TEXT NOT NULL,
      repeated_error_tags TEXT NOT NULL,
      last_3_weeks_focus TEXT NOT NULL,
      last_best_improvement TEXT NOT NULL,
      next_priority TEXT NOT NULL,
      preferred_tone TEXT NOT NULL DEFAULT '陈老师口语化',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      tag TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      file_url TEXT NOT NULL,
      preview_url TEXT NOT NULL,
      use_stage TEXT NOT NULL,
      paid_only INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      upload_id INTEGER,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      diagnosis_mode TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      input_size INTEGER NOT NULL,
      output_size INTEGER NOT NULL,
      estimated_cost REAL NOT NULL,
      latency_ms INTEGER NOT NULL,
      success INTEGER NOT NULL,
      error_code TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS result_page_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      diagnosis_id INTEGER NOT NULL,
      event_name TEXT NOT NULL,
      asset_id INTEGER,
      event_value TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const trialCount = (db.prepare(`SELECT COUNT(*) AS count FROM trial_access`).get() as { count: number }).count;
  if (trialCount === 0) {
    db.prepare(`INSERT INTO trial_access (user_id, student_id, phone, invite_code, whitelist_enabled, free_trial_total, free_trial_used, max_images_per_upload, enabled_grades, enabled_subjects, created_at, updated_at) VALUES (?, ?, '13800000001', 'CHENMATH01', 1, 6, 0, 1, ?, ?, ?, ?)`)
      .run(getPrimaryUserId(), getPrimaryStudentId(), stringify(["七年级", "八年级"]), stringify(["math", "english"]), now, now);
  }

  db.exec(`UPDATE trial_access SET free_trial_total = CASE WHEN free_trial_total < 50 THEN 50 ELSE free_trial_total END;`);

  const assetCount = (db.prepare(`SELECT COUNT(*) AS count FROM skill_assets`).get() as { count: number }).count;
  if (assetCount === 0) {
    const insert = db.prepare(`INSERT INTO skill_assets (subject, module, tag, difficulty, asset_type, title, summary, file_url, preview_url, use_stage, paid_only, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const asset of SKILL_ASSET_SEEDS) {
      insert.run(asset.subject, asset.module, asset.tag, asset.difficulty, asset.assetType, asset.title, asset.summary, asset.fileUrl, asset.previewUrl, asset.useStage, asset.paidOnly ? 1 : 0, now);
    }
  }
}

export function getTrialAccessSnapshot(studentId = getPrimaryStudentId()): TrialAccessSnapshot {
  ensureProductSchema();
  const db = getDb();
  const row = db.prepare(`SELECT ta.user_id, ta.student_id, ta.phone, ta.invite_code, ta.free_trial_total, ta.free_trial_used, ta.max_images_per_upload, ta.enabled_grades, ta.enabled_subjects, s.grade FROM trial_access ta INNER JOIN students s ON s.id = ta.student_id WHERE ta.student_id = ? LIMIT 1`).get(studentId) as { user_id: number; student_id: number; phone: string | null; invite_code: string | null; free_trial_total: number; free_trial_used: number; max_images_per_upload: number; enabled_grades: string; enabled_subjects: string; grade: string | null; };
  const enabledGrades = parseArray(row.enabled_grades);
  const enabledSubjects = parseArray(row.enabled_subjects).filter((item): item is Subject => item === "math" || item === "english");
  const gradeOpen = enabledGrades.length === 0 || enabledGrades.includes(row.grade ?? "");
  return { userId: row.user_id, studentId: row.student_id, phone: row.phone, inviteCode: row.invite_code, freeTrialTotal: row.free_trial_total, freeTrialUsed: row.free_trial_used, freeTrialRemaining: Math.max(0, row.free_trial_total - row.free_trial_used), maxImagesPerUpload: row.max_images_per_upload, enabledGrades, enabledSubjects, gradeOpen, subjectOpenMap: { math: enabledSubjects.includes("math"), english: enabledSubjects.includes("english") } };
}

export function verifyTrialIdentity(userId: number, phone?: string | null, inviteCode?: string | null) {
  ensureProductSchema();
  const db = getDb();
  const row = db.prepare(`SELECT phone, invite_code FROM trial_access WHERE user_id = ? LIMIT 1`).get(userId) as { phone: string | null; invite_code: string | null } | undefined;
  if (!row) return true;
  if (!phone && !inviteCode) return true;
  return row.phone === (phone ?? null) || row.invite_code === (inviteCode ?? null);
}

export function validateUploadAccess(studentId: number, subject: Subject, imageCount: number) {
  const access = getTrialAccessSnapshot(studentId);
  if (!access.gradeOpen) return { ok: false, message: "这位孩子现在还没开到这个年级，我先给你留着入口。" } as const;
  if (!access.subjectOpenMap[subject]) return { ok: false, message: `${subject === "math" ? "数学" : "英语"}这条线现在还没放开，我先替你记下。` } as const;
  if (imageCount > access.maxImagesPerUpload) return { ok: false, message: `这次先传 ${access.maxImagesPerUpload} 张就够了，我先帮你看最关键的那张。` } as const;
  if (access.freeTrialRemaining <= 0) return { ok: false, message: "免费体检先用完了，想继续追踪的话，直接切 4 周跟踪更合适。" } as const;
  return { ok: true, access } as const;
}

export function recordUploadMeta(uploadId: number, input: { stuckPointChoice?: string | null; stuckPointSource: StuckPointSource; stepsText?: string | null; hasSteps: boolean; stepQuality: StepQuality; imageCount: number; diagnosisMode: DiagnosisMode; }) {
  ensureProductSchema();
  const db = getDb();
  db.prepare(`UPDATE uploads SET stuck_point_choice = ?, stuck_point_source = ?, steps_text = ?, has_steps = ?, step_quality = ?, image_count = ?, diagnosis_mode = ? WHERE id = ?`)
    .run(input.stuckPointChoice ?? null, input.stuckPointSource, input.stepsText ?? null, input.hasSteps ? 1 : 0, input.stepQuality, input.imageCount, input.diagnosisMode, uploadId);
  db.prepare(`UPDATE trial_access SET free_trial_used = free_trial_used + 1, updated_at = ? WHERE student_id = (SELECT student_id FROM uploads WHERE id = ?)`)
    .run(new Date().toISOString(), uploadId);
}

export function enrichDiagnosisRecord(diagnosisId: number, input: { draftDiagnosis: DiagnosisPayload; diagnosisMode: DiagnosisMode; promptVersion: string; approvedDiagnosis?: DiagnosisPayload | null; reviewNotes?: string | null; reviewDiff?: Record<string, unknown> | null; }) {
  ensureProductSchema();
  const db = getDb();
  db.prepare(`UPDATE diagnoses SET draft_diagnosis = ?, approved_diagnosis = ?, review_notes = ?, review_diff = ?, diagnosis_mode = ?, prompt_version = ? WHERE id = ?`)
    .run(stringify(input.draftDiagnosis), input.approvedDiagnosis ? stringify(input.approvedDiagnosis) : null, input.reviewNotes ?? null, input.reviewDiff ? stringify(input.reviewDiff) : null, input.diagnosisMode, input.promptVersion, diagnosisId);
}

function diffPayload(previous: DiagnosisPayload, next: DiagnosisPayload) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(next) as Array<keyof DiagnosisPayload>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) diff[key] = { from: previous[key], to: next[key] };
  }
  return diff;
}

export function storeReviewedDiagnosis(diagnosisId: number, payload: DiagnosisPayload, reviewStatus: ReviewStatus, reviewNotes?: string | null) {
  ensureProductSchema();
  const db = getDb();
  const row = db.prepare(`SELECT draft_diagnosis FROM diagnoses WHERE id = ? LIMIT 1`).get(diagnosisId) as { draft_diagnosis: string | null } | undefined;
  const draft = parseObject<DiagnosisPayload>(row?.draft_diagnosis ?? null, payload);
  const approvedDiagnosis = reviewStatus === "rejected" ? null : { ...payload, review_status: reviewStatus };
  const reviewDiff = diffPayload(draft, { ...payload, review_status: reviewStatus });
  db.prepare(`UPDATE diagnoses SET approved_diagnosis = ?, review_notes = ?, review_diff = ? WHERE id = ?`).run(approvedDiagnosis ? stringify(approvedDiagnosis) : null, reviewNotes ?? null, stringify(reviewDiff), diagnosisId);
  return reviewDiff;
}

export function appendStructuredChangeLog(input: { studentId: number; subject: Subject; module: string; changeType: string; description: string; relatedDiagnosisId?: number | null; newIssues?: string[]; stabilizedIssues?: string[]; unstableIssues?: string[]; repeatedErrorTags?: string[]; evidenceSummary?: string | null; }) {
  ensureProductSchema();
  const db = getDb();
  db.prepare(`INSERT INTO change_logs (student_id, subject, module, change_type, description, related_diagnosis_id, new_issues, stabilized_issues, unstable_issues, repeated_error_tags, evidence_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.studentId, input.subject, input.module, input.changeType, input.description, input.relatedDiagnosisId ?? null, stringify(input.newIssues ?? []), stringify(input.stabilizedIssues ?? []), stringify(input.unstableIssues ?? []), stringify(input.repeatedErrorTags ?? []), input.evidenceSummary ?? null, new Date().toISOString());
}

export function buildStudentMemorySummary(studentId = getPrimaryStudentId()): MemorySummary {
  ensureProductSchema();
  const diagnoses = getStudentDiagnoses(studentId);
  const db = getDb();
  const weeklyReports = db.prepare(`SELECT report_json FROM weekly_reports WHERE student_id = ? ORDER BY created_at DESC LIMIT 3`).all(studentId) as Array<{ report_json: string }>;
  const approvedTags = diagnoses.filter((item) => item.review_status === "approved").flatMap((item) => parseArray(item.problem_tags));
  const allTags = diagnoses.flatMap((item) => parseArray(item.problem_tags));
  const repeatedTags = allTags.filter((tag, index, items) => items.indexOf(tag) !== index);
  const focus = weeklyReports.flatMap((item) => parseObject(item.report_json, DEFAULT_WEEKLY_REPORT).next_week_plan);
  const bestImprovement = weeklyReports.map((item) => parseObject(item.report_json, DEFAULT_WEEKLY_REPORT).improved_points[0]).find(Boolean) ?? "这周先从一个小改进稳住。";
  return rewriteMemorySummaryForChenTeacher({ stable_tags: Array.from(new Set(approvedTags)).slice(0, 3), repeated_error_tags: Array.from(new Set(repeatedTags.length > 0 ? repeatedTags : allTags)).slice(0, 4), last_3_weeks_focus: Array.from(new Set(focus)).slice(0, 3), last_best_improvement: bestImprovement, next_priority: focus[0] ?? diagnoses[0]?.current_stage ?? "先把最重复的错因压下来。", preferred_tone: "陈老师口语化", updated_at: new Date().toISOString() });
}

export function upsertStudentMemorySummary(studentId = getPrimaryStudentId()) {
  ensureProductSchema();
  const db = getDb();
  const summary = buildStudentMemorySummary(studentId);
  const exists = db.prepare(`SELECT id FROM student_memory WHERE student_id = ? LIMIT 1`).get(studentId) as { id: number } | undefined;
  if (exists) {
    db.prepare(`UPDATE student_memory SET stable_tags = ?, repeated_error_tags = ?, last_3_weeks_focus = ?, last_best_improvement = ?, next_priority = ?, preferred_tone = ?, updated_at = ? WHERE student_id = ?`).run(stringify(summary.stable_tags), stringify(summary.repeated_error_tags), stringify(summary.last_3_weeks_focus), summary.last_best_improvement, summary.next_priority, summary.preferred_tone, summary.updated_at, studentId);
  } else {
    db.prepare(`INSERT INTO student_memory (student_id, stable_tags, repeated_error_tags, last_3_weeks_focus, last_best_improvement, next_priority, preferred_tone, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(studentId, stringify(summary.stable_tags), stringify(summary.repeated_error_tags), stringify(summary.last_3_weeks_focus), summary.last_best_improvement, summary.next_priority, summary.preferred_tone, summary.updated_at);
  }
  return summary;
}

export function getStudentMemorySummary(studentId = getPrimaryStudentId()) {
  ensureProductSchema();
  const db = getDb();
  const row = db.prepare(`SELECT * FROM student_memory WHERE student_id = ? LIMIT 1`).get(studentId) as { stable_tags: string; repeated_error_tags: string; last_3_weeks_focus: string; last_best_improvement: string; next_priority: string; preferred_tone: string; updated_at: string; } | undefined;
  if (!row) return upsertStudentMemorySummary(studentId);
  return { stable_tags: parseArray(row.stable_tags), repeated_error_tags: parseArray(row.repeated_error_tags), last_3_weeks_focus: parseArray(row.last_3_weeks_focus), last_best_improvement: row.last_best_improvement, next_priority: row.next_priority, preferred_tone: row.preferred_tone, updated_at: row.updated_at };
}

export function getSkillAssets(subject?: Subject, module?: string) {
  ensureProductSchema();
  const db = getDb();
  let query = `SELECT * FROM skill_assets`;
  const params: Array<string> = [];
  if (subject && module) { query += ` WHERE subject = ? AND module = ?`; params.push(subject, module); }
  else if (subject) { query += ` WHERE subject = ?`; params.push(subject); }
  query += ` ORDER BY paid_only ASC, created_at ASC`;
  const rows = db.prepare(query).all(...params) as Array<{ id: number; subject: Subject; module: string; tag: string; difficulty: string; asset_type: string; title: string; summary: string; file_url: string; preview_url: string; use_stage: string; paid_only: number; }>;
  return rows.map((row) => ({ id: row.id, subject: row.subject, module: row.module, tag: row.tag, difficulty: row.difficulty, assetType: row.asset_type, title: row.title, summary: row.summary, fileUrl: row.file_url, previewUrl: row.preview_url, useStage: row.use_stage, paidOnly: Boolean(row.paid_only) })) satisfies SkillAsset[];
}

function inferAssetTag(detail: DiagnosisDetail) {
  const text = `${detail.problemTags.join(" ")} ${detail.stuckPointChoice ?? ""}`;
  if (detail.module === "几何") {
    if (text.includes("辅助线") || text.includes("画不出")) return "geometry_auxiliary_line_trigger";
    if (text.includes("关系") || text.includes("理不清")) return "geometry_relation_translation";
    return "geometry_proof_skeleton";
  }
  if (text.includes("开始")) return "function_entry_step";
  if (text.includes("图像") || text.includes("条件")) return "function_graph_condition_link";
  return "function_vertex_axis_opening";
}

export function getEnhancedDiagnosisDetail(id: number): DiagnosisDetail | null {
  ensureProductSchema();
  const db = getDb();
  const row = db.prepare(`SELECT d.id, d.upload_id, d.subject, d.module, d.current_stage, d.problem_tags, d.repair_actions, d.parent_summary, d.confidence, d.review_status, d.diagnosis_json, d.draft_diagnosis, d.approved_diagnosis, d.review_notes, d.review_diff, d.diagnosis_mode, d.created_at, u.student_id, u.score_note, u.student_self_report, u.stuck_point_choice, u.stuck_point_source, u.steps_text, u.has_steps, u.step_quality, u.file_name, s.name AS student_name FROM diagnoses d INNER JOIN uploads u ON u.id = d.upload_id INNER JOIN students s ON s.id = u.student_id WHERE d.id = ?`).get(id) as any;
  if (!row) return null;
  const fallback: DiagnosisPayload = { current_stage: row.current_stage, subject: row.subject, module: row.module, problem_tags: parseArray(row.problem_tags), repair_actions: parseArray(row.repair_actions), parent_summary: row.parent_summary, confidence: row.confidence, review_status: row.review_status };
  const draftDiagnosis = parseObject<DiagnosisPayload>(row.draft_diagnosis, fallback);
  const approvedDiagnosis = row.approved_diagnosis ? parseObject<DiagnosisPayload>(row.approved_diagnosis, draftDiagnosis) : null;
  return { id: row.id, studentId: row.student_id, studentName: row.student_name, uploadId: row.upload_id, subject: row.subject, module: row.module, diagnosisMode: (row.diagnosis_mode ?? "standard") as DiagnosisMode, currentStage: row.current_stage, problemTags: parseArray(row.problem_tags), repairActions: parseArray(row.repair_actions), parentSummary: row.parent_summary, confidence: row.confidence, reviewStatus: row.review_status, rawJson: approvedDiagnosis ?? draftDiagnosis, draftDiagnosis, approvedDiagnosis, reviewNotes: row.review_notes, reviewDiff: parseObject<Record<string, unknown> | null>(row.review_diff, null), createdAt: row.created_at, scoreNote: row.score_note, studentSelfReport: row.student_self_report, stuckPointChoice: row.stuck_point_choice, stuckPointSource: (row.stuck_point_source ?? "parent_selected") as StuckPointSource, stepsText: row.steps_text, hasSteps: Boolean(row.has_steps), stepQuality: (row.step_quality ?? "none") as StepQuality, fileName: row.file_name };
}

export function getRecommendedSkillAssetByDiagnosis(diagnosisId: number) {
  const detail = getEnhancedDiagnosisDetail(diagnosisId);
  if (!detail) return null;
  const assets = getSkillAssets(detail.subject, detail.module);
  const preferredTag = inferAssetTag(detail);
  return assets.find((asset) => asset.tag === preferredTag) ?? assets[0] ?? null;
}

export function createModelCallLog(input: Omit<ModelCallLogDetail, "id" | "createdAt">) {
  ensureProductSchema();
  const db = getDb();
  db.prepare(`INSERT INTO model_call_logs (student_id, upload_id, provider, model_name, diagnosis_mode, prompt_version, input_size, output_size, estimated_cost, latency_ms, success, error_code, retry_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.studentId, input.uploadId, input.provider, input.modelName, input.diagnosisMode, input.promptVersion, input.inputSize, input.outputSize, input.estimatedCost, input.latencyMs, input.success ? 1 : 0, input.errorCode, input.retryCount, new Date().toISOString());
}

export function appendResultPageEvent(input: { studentId: number; diagnosisId: number; eventName: ResultEventName; assetId?: number | null; eventValue?: string | null; }) {
  ensureProductSchema();
  const db = getDb();
  db.prepare(`INSERT INTO result_page_events (student_id, diagnosis_id, event_name, asset_id, event_value, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(input.studentId, input.diagnosisId, input.eventName, input.assetId ?? null, input.eventValue ?? null, new Date().toISOString());
}

export function getSkillAssetSeedSummary() {
  return getSkillAssets("math").filter((asset) => asset.module === "几何" || asset.module === "函数");
}

export function getCurrentTableCounts() {
  ensureProductSchema();
  const db = getDb();
  const tables = ["trial_access", "student_memory", "skill_assets", "model_call_logs", "result_page_events"];
  return Object.fromEntries(tables.map((table) => [table, (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count]));
}
