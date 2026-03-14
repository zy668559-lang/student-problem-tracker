import { getDb, getPrimaryStudentId } from "@/lib/db";
import { rewriteMemorySummaryForChenTeacher } from "@/lib/services/tone-chen";
import type { MemorySummary, ReviewStatus } from "@/lib/types";

function parseArray(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function ensureMemorySummaryTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      stable_tags TEXT NOT NULL,
      repeated_error_tags TEXT NOT NULL,
      last_3_weeks_focus TEXT NOT NULL,
      next_priority TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);
}

function pickTopItems(items: string[], count: number) {
  return Array.from(new Set(items.filter(Boolean))).slice(0, count);
}

export function buildMemorySummary(studentId = getPrimaryStudentId()): MemorySummary {
  ensureMemorySummaryTable();
  const db = getDb();

  const diagnoses = db
    .prepare(
      `
        SELECT d.problem_tags, d.repair_actions, d.review_status, d.module
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE u.student_id = ?
        ORDER BY d.created_at DESC
        LIMIT 12
      `
    )
    .all(studentId) as Array<{
    problem_tags: string;
    repair_actions: string;
    review_status: ReviewStatus;
    module: string;
  }>;

  const weeklyReports = db
    .prepare(
      `
        SELECT next_week_plan, repeated_error_tags
        FROM weekly_reports
        WHERE student_id = ?
        ORDER BY created_at DESC
        LIMIT 3
      `
    )
    .all(studentId) as Array<{
    next_week_plan: string;
    repeated_error_tags: string;
  }>;

  const approvedTags = diagnoses
    .filter((item) => item.review_status === "approved")
    .flatMap((item) => parseArray(item.problem_tags));
  const allTags = diagnoses.flatMap((item) => parseArray(item.problem_tags));
  const repeatedTags = allTags.filter((tag, index, array) => array.indexOf(tag) !== index);
  const last3WeeksFocus = weeklyReports.flatMap((item) => parseArray(item.next_week_plan));
  const latestActions = diagnoses.flatMap((item) => parseArray(item.repair_actions));

  const summary = rewriteMemorySummaryForChenTeacher({
    stable_tags: pickTopItems(approvedTags, 3),
    repeated_error_tags: pickTopItems(repeatedTags.length > 0 ? repeatedTags : allTags, 4),
    last_3_weeks_focus: pickTopItems(last3WeeksFocus.length > 0 ? last3WeeksFocus : latestActions, 3),
    next_priority: pickTopItems(last3WeeksFocus, 1)[0] ?? latestActions[0] ?? "先把重复错因压下去，再往下加新题型"
  });

  return summary;
}

export function upsertMemorySummary(studentId = getPrimaryStudentId()) {
  ensureMemorySummaryTable();
  const db = getDb();
  const summary = buildMemorySummary(studentId);
  const now = new Date().toISOString();
  const existing = db
    .prepare(`SELECT id, created_at FROM memory_summaries WHERE student_id = ? LIMIT 1`)
    .get(studentId) as { id: number; created_at: string } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE memory_summaries
        SET stable_tags = ?, repeated_error_tags = ?, last_3_weeks_focus = ?,
            next_priority = ?, summary_json = ?, updated_at = ?
        WHERE student_id = ?
      `
    ).run(
      JSON.stringify(summary.stable_tags),
      JSON.stringify(summary.repeated_error_tags),
      JSON.stringify(summary.last_3_weeks_focus),
      summary.next_priority,
      JSON.stringify(summary),
      now,
      studentId
    );
  } else {
    db.prepare(
      `
        INSERT INTO memory_summaries (
          student_id, stable_tags, repeated_error_tags, last_3_weeks_focus,
          next_priority, summary_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      studentId,
      JSON.stringify(summary.stable_tags),
      JSON.stringify(summary.repeated_error_tags),
      JSON.stringify(summary.last_3_weeks_focus),
      summary.next_priority,
      JSON.stringify(summary),
      now,
      now
    );
  }

  return summary;
}

export function getMemorySummary(studentId = getPrimaryStudentId()): MemorySummary {
  ensureMemorySummaryTable();
  const db = getDb();
  const row = db
    .prepare(`SELECT summary_json FROM memory_summaries WHERE student_id = ? LIMIT 1`)
    .get(studentId) as { summary_json: string } | undefined;

  if (!row) {
    return upsertMemorySummary(studentId);
  }

  try {
    return JSON.parse(row.summary_json) as MemorySummary;
  } catch {
    return upsertMemorySummary(studentId);
  }
}
