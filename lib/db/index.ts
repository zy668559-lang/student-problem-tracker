import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_WEEKLY_REPORT,
  MOCK_DIAGNOSIS_TEMPLATES,
  SUBJECT_MODULES,
  SUBJECT_STAGE_COPY
} from "@/lib/mock-data";
import type {
  DashboardSnapshot,
  DiagnosisDetail,
  DiagnosisPayload,
  ReviewQueueItem,
  ReviewStatus,
  Subject,
  SubjectSnapshot,
  WeeklyReportDetail,
  WeeklyReportPayload
} from "@/lib/types";

type SqlValue = string | number | null;

let database: Database.Database | null = null;

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "student-problem-tracker.db");

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return JSON.parse(value) as string[];
}

function parseJsonObject<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  return JSON.parse(value) as T;
}

function getWeekLabel() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function rowExists(db: Database.Database, table: string) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count > 0;
}

function seedDatabase(db: Database.Database) {
  if (rowExists(db, "users")) {
    return;
  }

  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO users (name, email, password, role, created_at)
      VALUES
      ('家长演示账号', 'parent@example.com', 'demo123', 'parent', ?),
      ('教研审核员', 'reviewer@example.com', 'demo123', 'reviewer', ?)
    `
  ).run(now, now);

  db.prepare(
    `
      INSERT INTO students (user_id, name, grade, school, created_at)
      VALUES (1, '林同学', '七年级', '本地演示学校', ?)
    `
  ).run(now);

  db.prepare(
    `
      INSERT INTO uploads (
        student_id, subject, module, score_note, note, student_self_report,
        upload_type, file_name, file_path, created_at
      )
      VALUES
      (1, 'math', '函数', '83 / 100', '单元练习卷', '图像题一换条件就不会', '试卷图', 'math-function-demo.png', 'uploads/math-function-demo.png', datetime('now', '-4 day')),
      (1, 'english', '阅读定位', '18 / 30', '周测阅读', '题干看懂了但是找不到原文', '题图', 'english-reading-demo.png', 'uploads/english-reading-demo.png', datetime('now', '-2 day'))
    `
  ).run();

  const mathDiagnosis = MOCK_DIAGNOSIS_TEMPLATES.math[0];
  const englishDiagnosis = MOCK_DIAGNOSIS_TEMPLATES.english[0];

  db.prepare(
    `
      INSERT INTO diagnoses (
        upload_id, current_stage, subject, module, problem_tags, repair_actions,
        parent_summary, confidence, review_status, diagnosis_json, created_at, updated_at
      )
      VALUES
      (1, @mathStage, 'math', '函数', @mathTags, @mathActions, @mathSummary, @mathConfidence, 'approved', @mathJson, datetime('now', '-4 day'), datetime('now', '-4 day')),
      (2, @engStage, 'english', '阅读定位', @engTags, @engActions, @engSummary, @engConfidence, 'pending', @engJson, datetime('now', '-2 day'), datetime('now', '-2 day'))
    `
  ).run({
    mathStage: mathDiagnosis.current_stage,
    mathTags: stringify(mathDiagnosis.problem_tags),
    mathActions: stringify(mathDiagnosis.repair_actions),
    mathSummary: mathDiagnosis.parent_summary,
    mathConfidence: mathDiagnosis.confidence,
    mathJson: stringify({ ...mathDiagnosis, review_status: "approved" }),
    engStage: englishDiagnosis.current_stage,
    engTags: stringify(englishDiagnosis.problem_tags),
    engActions: stringify(englishDiagnosis.repair_actions),
    engSummary: englishDiagnosis.parent_summary,
    engConfidence: englishDiagnosis.confidence,
    engJson: stringify(englishDiagnosis)
  });

  db.prepare(
    `
      INSERT INTO repair_tasks (diagnosis_id, student_id, subject, module, action_text, status, due_date, created_at)
      VALUES
      (1, 1, 'math', '函数', '每天 1 组函数图像判读卡片', 'in_progress', date('now', '+3 day'), datetime('now', '-4 day')),
      (1, 1, 'math', '函数', '错题二次复做时先口述思路再下笔', 'pending', date('now', '+5 day'), datetime('now', '-4 day')),
      (2, 1, 'english', '阅读定位', '每篇阅读记录 3 组同义替换', 'pending', date('now', '+4 day'), datetime('now', '-2 day'))
    `
  ).run();

  const weeklyPayload: WeeklyReportPayload = {
    this_week_problem: ["函数图像与条件联动不稳", "阅读定位后同义替换识别仍失分"],
    this_week_actions: [
      "函数模块每天固定判图练习",
      "阅读理解每篇沉淀 3 组定位句和替换句"
    ],
    improved_points: ["愿意复盘错题", "阅读题干关键词开始会圈画"],
    unstable_points: ["数学漏条件回弹", "英语定位后选项比较仍易犹豫"],
    repeated_error_tags: ["审题遗漏条件", "同义替换识别"],
    next_week_plan: ["数学聚焦函数", "英语聚焦阅读定位与完形逻辑连接词"]
  };

  db.prepare(
    `
      INSERT INTO weekly_reports (
        student_id, week_label, this_week_problem, this_week_actions, improved_points,
        unstable_points, repeated_error_tags, next_week_plan, report_json, created_at
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))
    `
  ).run(
    getWeekLabel(),
    stringify(weeklyPayload.this_week_problem),
    stringify(weeklyPayload.this_week_actions),
    stringify(weeklyPayload.improved_points),
    stringify(weeklyPayload.unstable_points),
    stringify(weeklyPayload.repeated_error_tags),
    stringify(weeklyPayload.next_week_plan),
    stringify(weeklyPayload)
  );

  db.prepare(
    `
      INSERT INTO change_logs (student_id, subject, module, change_type, description, related_diagnosis_id, created_at)
      VALUES
      (1, 'math', '函数', 'improved', '开始主动补写条件到图像变化', 1, datetime('now', '-3 day')),
      (1, 'english', '阅读定位', 'unstable', '定位后仍会被同义替换干扰', 2, datetime('now', '-1 day'))
    `
  ).run();
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      grade TEXT,
      school TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      score_note TEXT,
      note TEXT,
      student_self_report TEXT,
      upload_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS diagnoses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL,
      current_stage TEXT NOT NULL,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      problem_tags TEXT NOT NULL,
      repair_actions TEXT NOT NULL,
      parent_summary TEXT NOT NULL,
      confidence REAL NOT NULL,
      review_status TEXT NOT NULL,
      diagnosis_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );

    CREATE TABLE IF NOT EXISTS repair_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diagnosis_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      action_text TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      week_label TEXT NOT NULL,
      this_week_problem TEXT NOT NULL,
      this_week_actions TEXT NOT NULL,
      improved_points TEXT NOT NULL,
      unstable_points TEXT NOT NULL,
      repeated_error_tags TEXT NOT NULL,
      next_week_plan TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      module TEXT NOT NULL,
      change_type TEXT NOT NULL,
      description TEXT NOT NULL,
      related_diagnosis_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (related_diagnosis_id) REFERENCES diagnoses(id)
    );
  `);
}

export function getDb() {
  if (database) {
    return database;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  database = new Database(dbPath);
  initializeSchema(database);
  seedDatabase(database);
  return database;
}

export function authenticateUser(email: string, password: string) {
  const db = getDb();
  const user = db
    .prepare(
      `
        SELECT u.id, u.name, u.email, u.role, s.id AS student_id, s.name AS student_name
        FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        WHERE u.email = ? AND u.password = ?
      `
    )
    .get(email, password) as
    | {
        id: number;
        name: string;
        email: string;
        role: string;
        student_id: number | null;
        student_name: string | null;
      }
    | undefined;

  return user ?? null;
}

export function getPrimaryStudentId() {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM students ORDER BY id ASC LIMIT 1`).get() as {
    id: number;
  };
  return row.id;
}

export function getDashboardSnapshot(studentId = getPrimaryStudentId()): DashboardSnapshot {
  const db = getDb();
  const student = db
    .prepare(`SELECT name FROM students WHERE id = ?`)
    .get(studentId) as { name: string };

  const uploadRow = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM uploads
        WHERE student_id = ? AND date(created_at) >= date('now', '-6 day')
      `
    )
    .get(studentId) as { count: number };

  const diagnosisRows = db
    .prepare(
      `
        SELECT d.id, d.current_stage, d.problem_tags, d.repair_actions
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE u.student_id = ?
        ORDER BY d.created_at DESC
        LIMIT 3
      `
    )
    .all(studentId) as Array<{
    id: number;
    current_stage: string;
    problem_tags: string;
    repair_actions: string;
  }>;

  const changeRows = db
    .prepare(
      `
        SELECT description
        FROM change_logs
        WHERE student_id = ?
        ORDER BY created_at DESC
        LIMIT 3
      `
    )
    .all(studentId) as Array<{ description: string }>;

  const reportRow = db
    .prepare(
      `
        SELECT id, report_json
        FROM weekly_reports
        WHERE student_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(studentId) as { id: number; report_json: string } | undefined;

  const latestDiagnosis = diagnosisRows[0];
  const latestReport = parseJsonObject(reportRow?.report_json ?? null, DEFAULT_WEEKLY_REPORT);

  return {
    studentName: student.name,
    currentStage: latestDiagnosis?.current_stage ?? "等待首次上传后生成阶段判断",
    weeklyUploadCount: uploadRow.count,
    weeklyProblems: diagnosisRows.flatMap((row) => parseJsonArray(row.problem_tags)).slice(0, 4),
    weeklyActions: diagnosisRows.flatMap((row) => parseJsonArray(row.repair_actions)).slice(0, 4),
    weeklyChanges: changeRows.map((row) => row.description),
    nextWeekFocus: latestReport.next_week_plan,
    latestDiagnosisId: latestDiagnosis?.id ?? null,
    latestWeeklyReportId: reportRow?.id ?? null
  };
}

export function getSubjectSnapshot(subject: Subject, studentId = getPrimaryStudentId()): SubjectSnapshot {
  const db = getDb();
  const diagnosisRows = db
    .prepare(
      `
        SELECT d.current_stage, d.problem_tags, d.repair_actions, d.module
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE u.student_id = ? AND d.subject = ?
        ORDER BY d.created_at DESC
        LIMIT 5
      `
    )
    .all(studentId, subject) as Array<{
    current_stage: string;
    problem_tags: string;
    repair_actions: string;
    module: string;
  }>;

  const changeRows = db
    .prepare(
      `
        SELECT description
        FROM change_logs
        WHERE student_id = ? AND subject = ?
        ORDER BY created_at DESC
        LIMIT 4
      `
    )
    .all(studentId, subject) as Array<{ description: string }>;

  const repeatedTags = Array.from(
    new Set(diagnosisRows.flatMap((row) => parseJsonArray(row.problem_tags)))
  ).slice(0, 4);

  return {
    subject,
    currentStage: diagnosisRows[0]?.current_stage ?? SUBJECT_STAGE_COPY[subject],
    weeklyProblems: diagnosisRows.flatMap((row) => parseJsonArray(row.problem_tags)).slice(0, 4),
    weeklyActions: diagnosisRows.flatMap((row) => parseJsonArray(row.repair_actions)).slice(0, 4),
    repeatedTags,
    recentChanges: changeRows.map((row) => row.description),
    modules: SUBJECT_MODULES[subject]
  };
}

export function getDiagnosisDetail(id: number): DiagnosisDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          d.id,
          d.upload_id,
          d.subject,
          d.module,
          d.current_stage,
          d.problem_tags,
          d.repair_actions,
          d.parent_summary,
          d.confidence,
          d.review_status,
          d.diagnosis_json,
          d.created_at,
          u.score_note,
          u.student_self_report,
          u.file_name,
          s.name AS student_name
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        INNER JOIN students s ON s.id = u.student_id
        WHERE d.id = ?
      `
    )
    .get(id) as
    | {
        id: number;
        upload_id: number;
        subject: Subject;
        module: string;
        current_stage: string;
        problem_tags: string;
        repair_actions: string;
        parent_summary: string;
        confidence: number;
        review_status: ReviewStatus;
        diagnosis_json: string;
        created_at: string;
        score_note: string | null;
        student_self_report: string | null;
        file_name: string;
        student_name: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    studentName: row.student_name,
    uploadId: row.upload_id,
    subject: row.subject,
    module: row.module,
    currentStage: row.current_stage,
    problemTags: parseJsonArray(row.problem_tags),
    repairActions: parseJsonArray(row.repair_actions),
    parentSummary: row.parent_summary,
    confidence: row.confidence,
    reviewStatus: row.review_status,
    rawJson: parseJsonObject(row.diagnosis_json, {
      current_stage: row.current_stage,
      subject: row.subject,
      module: row.module,
      problem_tags: [],
      repair_actions: [],
      parent_summary: row.parent_summary,
      confidence: row.confidence,
      review_status: row.review_status
    }),
    createdAt: row.created_at,
    scoreNote: row.score_note,
    studentSelfReport: row.student_self_report,
    fileName: row.file_name
  };
}

export function getLatestWeeklyReport(studentId = getPrimaryStudentId()) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id
        FROM weekly_reports
        WHERE student_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(studentId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getWeeklyReportDetail(id: number): WeeklyReportDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT wr.id, wr.week_label, wr.report_json, wr.created_at, s.name AS student_name
        FROM weekly_reports wr
        INNER JOIN students s ON s.id = wr.student_id
        WHERE wr.id = ?
      `
    )
    .get(id) as
    | {
        id: number;
        week_label: string;
        report_json: string;
        created_at: string;
        student_name: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    studentName: row.student_name,
    weekLabel: row.week_label,
    payload: parseJsonObject(row.report_json, DEFAULT_WEEKLY_REPORT),
    createdAt: row.created_at
  };
}

export function getReviewQueue(): ReviewQueueItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT d.id, d.subject, d.module, d.review_status, d.confidence, d.created_at, d.diagnosis_json, s.name AS student_name
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        INNER JOIN students s ON s.id = u.student_id
        ORDER BY
          CASE d.review_status
            WHEN 'pending' THEN 0
            WHEN 'edited' THEN 1
            WHEN 'approved' THEN 2
            ELSE 3
          END,
          d.created_at DESC
      `
    )
    .all() as Array<{
    id: number;
    subject: Subject;
    module: string;
    review_status: ReviewStatus;
    confidence: number;
    created_at: string;
    diagnosis_json: string;
    student_name: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    studentName: row.student_name,
    subject: row.subject,
    module: row.module,
    reviewStatus: row.review_status,
    confidence: row.confidence,
    createdAt: row.created_at,
    payload: parseJsonObject(row.diagnosis_json, MOCK_DIAGNOSIS_TEMPLATES[row.subject][0])
  }));
}

export function createUploadRecord(input: {
  studentId: number;
  subject: Subject;
  module: string;
  scoreNote?: string | null;
  note?: string | null;
  studentSelfReport?: string | null;
  uploadType: string;
  fileName: string;
  filePath: string;
}) {
  const db = getDb();
  const result = db
    .prepare(
      `
        INSERT INTO uploads (
          student_id, subject, module, score_note, note, student_self_report,
          upload_type, file_name, file_path, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.studentId,
      input.subject,
      input.module,
      input.scoreNote ?? null,
      input.note ?? null,
      input.studentSelfReport ?? null,
      input.uploadType,
      input.fileName,
      input.filePath,
      new Date().toISOString()
    );

  return Number(result.lastInsertRowid);
}

export function createDiagnosisRecord(uploadId: number, diagnosis: DiagnosisPayload) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO diagnoses (
          upload_id, current_stage, subject, module, problem_tags, repair_actions,
          parent_summary, confidence, review_status, diagnosis_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      uploadId,
      diagnosis.current_stage,
      diagnosis.subject,
      diagnosis.module,
      stringify(diagnosis.problem_tags),
      stringify(diagnosis.repair_actions),
      diagnosis.parent_summary,
      diagnosis.confidence,
      diagnosis.review_status,
      stringify(diagnosis),
      now,
      now
    );

  return Number(result.lastInsertRowid);
}

export function createRepairTasks(
  diagnosisId: number,
  studentId: number,
  subject: Subject,
  module: string,
  actions: string[]
) {
  const db = getDb();
  const insert = db.prepare(
    `
      INSERT INTO repair_tasks (diagnosis_id, student_id, subject, module, action_text, status, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', date('now', '+7 day'), ?)
    `
  );
  const now = new Date().toISOString();
  const transaction = db.transaction((items: string[]) => {
    for (const action of items) {
      insert.run(diagnosisId, studentId, subject, module, action, now);
    }
  });
  transaction(actions);
}

export function replaceRepairTasksForDiagnosis(
  diagnosisId: number,
  studentId: number,
  subject: Subject,
  module: string,
  actions: string[],
  reviewStatus: ReviewStatus
) {
  const db = getDb();
  const remove = db.prepare(`DELETE FROM repair_tasks WHERE diagnosis_id = ?`);
  const insert = db.prepare(
    `
      INSERT INTO repair_tasks (diagnosis_id, student_id, subject, module, action_text, status, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', date('now', '+7 day'), ?)
    `
  );
  const now = new Date().toISOString();
  const transaction = db.transaction((items: string[]) => {
    remove.run(diagnosisId);
    if (reviewStatus === "rejected") {
      return;
    }
    for (const action of items) {
      insert.run(diagnosisId, studentId, subject, module, action, now);
    }
  });
  transaction(actions);
}

export function appendChangeLog(
  studentId: number,
  subject: Subject,
  module: string,
  changeType: string,
  description: string,
  relatedDiagnosisId: number | null = null
) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO change_logs (student_id, subject, module, change_type, description, related_diagnosis_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(studentId, subject, module, changeType, description, relatedDiagnosisId, new Date().toISOString());
}

export function upsertWeeklyReport(studentId: number, payload: WeeklyReportPayload) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `
        SELECT id
        FROM weekly_reports
        WHERE student_id = ? AND week_label = ?
        LIMIT 1
      `
    )
    .get(studentId, getWeekLabel()) as { id: number } | undefined;

  const params: SqlValue[] = [
    stringify(payload.this_week_problem),
    stringify(payload.this_week_actions),
    stringify(payload.improved_points),
    stringify(payload.unstable_points),
    stringify(payload.repeated_error_tags),
    stringify(payload.next_week_plan),
    stringify(payload),
    now
  ];

  if (existing) {
    db.prepare(
      `
        UPDATE weekly_reports
        SET this_week_problem = ?, this_week_actions = ?, improved_points = ?,
            unstable_points = ?, repeated_error_tags = ?, next_week_plan = ?,
            report_json = ?, created_at = ?
        WHERE id = ?
      `
    ).run(...params, existing.id);
    return existing.id;
  }

  const result = db
    .prepare(
      `
        INSERT INTO weekly_reports (
          student_id, week_label, this_week_problem, this_week_actions, improved_points,
          unstable_points, repeated_error_tags, next_week_plan, report_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      studentId,
      getWeekLabel(),
      payload.this_week_problem ? stringify(payload.this_week_problem) : "[]",
      payload.this_week_actions ? stringify(payload.this_week_actions) : "[]",
      payload.improved_points ? stringify(payload.improved_points) : "[]",
      payload.unstable_points ? stringify(payload.unstable_points) : "[]",
      payload.repeated_error_tags ? stringify(payload.repeated_error_tags) : "[]",
      payload.next_week_plan ? stringify(payload.next_week_plan) : "[]",
      stringify(payload),
      now
    );
  return Number(result.lastInsertRowid);
}

export function getStudentDiagnoses(studentId = getPrimaryStudentId()) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT d.subject, d.module, d.problem_tags, d.repair_actions, d.review_status, d.current_stage
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE u.student_id = ?
        ORDER BY d.created_at DESC
        LIMIT 6
      `
    )
    .all(studentId) as Array<{
    subject: Subject;
    module: string;
    problem_tags: string;
    repair_actions: string;
    review_status: ReviewStatus;
    current_stage: string;
  }>;
  return rows;
}

export function updateDiagnosisReview(id: number, payload: DiagnosisPayload, reviewStatus: ReviewStatus) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE diagnoses
      SET current_stage = ?, subject = ?, module = ?, problem_tags = ?, repair_actions = ?,
          parent_summary = ?, confidence = ?, review_status = ?, diagnosis_json = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(
    payload.current_stage,
    payload.subject,
    payload.module,
    stringify(payload.problem_tags),
    stringify(payload.repair_actions),
    payload.parent_summary,
    payload.confidence,
    reviewStatus,
    stringify({ ...payload, review_status: reviewStatus }),
    now,
    id
  );
}

export function getReviewContext(id: number) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT u.student_id, d.subject, d.module
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE d.id = ?
      `
    )
    .get(id) as { student_id: number; subject: Subject; module: string } | undefined;
}
