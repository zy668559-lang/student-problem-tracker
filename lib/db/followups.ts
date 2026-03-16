import { getDb } from "@/lib/db";
import { ensureA4Schema } from "@/lib/db/a4";
import { appendAdminActionLog, ensureAdminSchema } from "@/lib/db/admin";
import {
  activateMembershipFromIntent,
  closeMembershipIntent,
  ensureMembershipSchema
} from "@/lib/db/membership";
import { ensureP25Schema } from "@/lib/db/p25";
import { ensureProductSchema } from "@/lib/db/product";
import type {
  AppSession,
  FollowupActionDetail,
  FollowupActionType,
  FollowupBoardSnapshot,
  FollowupLeadDetail,
  FollowupReminderBucket,
  FollowupTemplate,
  LeadFollowupStatus,
  Subject
} from "@/lib/types";

const FOLLOWUP_STATUSES: LeadFollowupStatus[] = ["new_intent", "contacted", "follow_up_pending", "activated", "not_needed", "rejected"];
const OPEN_STATUSES: LeadFollowupStatus[] = ["new_intent", "contacted", "follow_up_pending"];

const FOLLOWUP_TEMPLATES: FollowupTemplate[] = [
  {
    id: "first_contact",
    title: "首次跟进模板",
    body: "家长您好，我是陈老师。我先不讲一堆大道理，就说最关键的一句：孩子这次不是完全不会，是有一个点老反复。我已经把时间轴证据串好了，您花两分钟看一眼，就能知道这周先盯哪一步。"
  },
  {
    id: "second_followup",
    title: "二次回访模板",
    body: "我再补一句，这条不是完全没进步，而是已经有起色了，但还没稳。现在最怕的是刚松手，它又掉回去。所以这周别换线，就顺着这一个卡点再盯一轮。"
  },
  {
    id: "closing_template",
    title: "开通前收口模板",
    body: "如果您想看的不是今天这道题对没对，而是这类问题 4 周后到底稳没稳，那继续追踪会更值。因为每次上传、诊断、复检、周报和变化，我这边都会接成一条证据线，不用再靠感觉判断。"
  }
];

function ensureColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(value: string | null | undefined): LeadFollowupStatus {
  if (value === "new_intent" || value === "contacted" || value === "follow_up_pending" || value === "activated" || value === "not_needed" || value === "rejected") {
    return value;
  }
  return "new_intent";
}

function normalizeActionType(value: string | null | undefined): FollowupActionType | null {
  if (
    value === "wechat_contacted" ||
    value === "phone_contacted" ||
    value === "follow_up_pending" ||
    value === "timeline_sent" ||
    value === "advice_sent" ||
    value === "parent_hesitating" ||
    value === "parent_rejected" ||
    value === "activated"
  ) {
    return value;
  }
  return null;
}

function studentCode(studentId: number) {
  return `STU-${String(studentId).padStart(4, "0")}`;
}

function getActionLabel(actionType: FollowupActionType) {
  switch (actionType) {
    case "wechat_contacted":
      return "微信已联系";
    case "phone_contacted":
      return "电话已联系";
    case "follow_up_pending":
      return "待回访";
    case "timeline_sent":
      return "已发送时间轴截图";
    case "advice_sent":
      return "已发送建议";
    case "parent_hesitating":
      return "家长犹豫";
    case "parent_rejected":
      return "家长拒绝";
    case "activated":
      return "已开通";
    default:
      return "已跟进";
  }
}

function defaultStatusFromAction(actionType: FollowupActionType): LeadFollowupStatus {
  switch (actionType) {
    case "wechat_contacted":
    case "phone_contacted":
    case "timeline_sent":
    case "advice_sent":
      return "contacted";
    case "follow_up_pending":
    case "parent_hesitating":
      return "follow_up_pending";
    case "parent_rejected":
      return "rejected";
    case "activated":
      return "activated";
    default:
      return "new_intent";
  }
}

function sourceLabel(sourceType: string) {
  switch (sourceType) {
    case "click_continue_tracking":
      return "结果页点了继续追踪";
    case "tracking_intent":
      return "提交了开通意向";
    case "timeline_cta":
      return "时间轴页 CTA";
    case "compare_cta":
      return "结果对比页 CTA";
    default:
      return sourceType;
  }
}

function parseObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseArray(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function getLeadSnapshot(studentId: number, diagnosisId?: number | null) {
  const db = getDb();
  const student = db.prepare(`
    SELECT s.id, s.name, s.grade, u.id AS parent_account_id, u.name AS parent_name, u.email AS parent_email
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
    LIMIT 1
  `).get(studentId) as {
    id: number;
    name: string;
    grade: string | null;
    parent_account_id: number;
    parent_name: string;
    parent_email: string;
  } | undefined;

  if (!student) {
    throw new Error("student_not_found");
  }

  const targetDiagnosis = diagnosisId
    ? db.prepare(`
        SELECT d.id, d.subject, d.module, d.current_stage, d.continue_tracking_reason, u.student_self_report
        FROM diagnoses d
        INNER JOIN uploads u ON u.id = d.upload_id
        WHERE d.id = ? AND u.student_id = ?
        LIMIT 1
      `).get(diagnosisId, studentId) as {
        id: number;
        subject: Subject;
        module: string;
        current_stage: string | null;
        continue_tracking_reason: string | null;
        student_self_report: string | null;
      } | undefined
    : undefined;

  const latestDiagnosis = targetDiagnosis ?? db.prepare(`
    SELECT d.id, d.subject, d.module, d.current_stage, d.continue_tracking_reason, u.student_self_report
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    subject: Subject;
    module: string;
    current_stage: string | null;
    continue_tracking_reason: string | null;
    student_self_report: string | null;
  } | undefined;

  const weeklyRow = db.prepare(`
    SELECT report_json
    FROM weekly_reports
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(studentId) as { report_json: string | null } | undefined;

  const weeklyPayload = parseObject(weeklyRow?.report_json, {
    this_week_problem: [] as string[],
    unstable_points: [] as string[],
    next_priority: null as string | null,
    continue_tracking_reason: null as string | null,
    parent_weekly_summary: null as string | null
  });

  const blockPoint = latestDiagnosis?.current_stage ?? latestDiagnosis?.student_self_report ?? weeklyPayload.this_week_problem?.[0] ?? "这条线索的主卡点我还在继续归拢。";
  return {
    parentAccountId: student.parent_account_id,
    parentName: student.parent_name,
    parentEmail: student.parent_email,
    studentName: student.name,
    grade: student.grade,
    subject: latestDiagnosis?.subject ?? null,
    module: latestDiagnosis?.module ?? null,
    latestEvidenceSummary: latestDiagnosis?.current_stage ?? weeklyPayload.parent_weekly_summary ?? "这位孩子最近的证据我已经接上了。",
    latestBlockPoint: blockPoint,
    weeklyChangeSummary: weeklyPayload.parent_weekly_summary ?? weeklyPayload.this_week_problem?.[0] ?? "这周的变化我先记成有一点起色。",
    unstableStep: weeklyPayload.unstable_points?.[0] ?? weeklyPayload.next_priority ?? "这一步还没完全站住。",
    continueTrackingReason: latestDiagnosis?.continue_tracking_reason ?? weeklyPayload.continue_tracking_reason ?? "这块最怕看着好一点，过两天又掉回去。"
  };
}

function mapAction(row: any): FollowupActionDetail {
  return {
    id: row.id,
    leadId: row.lead_id,
    operatorUserId: row.operator_user_id,
    operatorName: row.operator_name,
    actionType: normalizeActionType(row.action_type) ?? "follow_up_pending",
    note: row.note ?? null,
    remindAt: row.remind_at ?? null,
    createdAt: row.created_at
  };
}

function mapLead(row: any, actions: FollowupActionDetail[]): FollowupLeadDetail {
  return {
    id: row.id,
    legacyLeadId: row.legacy_lead_id ?? null,
    trackingIntentId: row.tracking_intent_id ?? null,
    parentAccountId: row.parent_account_id,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    studentId: row.student_id,
    studentCode: studentCode(row.student_id),
    studentName: row.student_name,
    grade: row.grade ?? null,
    subject: row.subject ?? null,
    module: row.module ?? null,
    sourceType: row.source_type,
    sourceRefId: row.source_ref_id ?? null,
    latestEvidenceSummary: row.latest_evidence_summary,
    latestBlockPoint: row.latest_block_point,
    weeklyChangeSummary: row.weekly_change_summary,
    unstableStep: row.unstable_step,
    continueTrackingReason: row.continue_tracking_reason,
    status: normalizeStatus(row.status),
    lastContactAt: row.last_contact_at ?? null,
    nextFollowUpAt: row.next_follow_up_at ?? null,
    latestActionType: normalizeActionType(row.latest_action_type),
    latestActionSummary: row.latest_action_summary ?? null,
    followUpNote: row.follow_up_note ?? null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actions
  };
}

function getLeadRow(id: number) {
  const db = getDb();
  return db.prepare(`
    SELECT fl.*, u.name AS parent_name, u.email AS parent_email, s.name AS student_name
    FROM followup_leads fl
    INNER JOIN users u ON u.id = fl.parent_account_id
    INNER JOIN students s ON s.id = fl.student_id
    WHERE fl.id = ?
    LIMIT 1
  `).get(id) as any;
}

function listActionsForLead(leadId: number, limit = 6) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fa.*, u.name AS operator_name
    FROM followup_actions fa
    INNER JOIN users u ON u.id = fa.operator_user_id
    WHERE fa.lead_id = ?
    ORDER BY fa.created_at DESC, fa.id DESC
    LIMIT ?
  `).all(leadId, limit) as any[];
  return rows.map((row) => mapAction(row));
}

function upsertLead(input: {
  legacyLeadId?: number | null;
  trackingIntentId?: number | null;
  parentAccountId: number;
  studentId: number;
  sourceType: string;
  sourceRefId?: number | null;
  diagnosisId?: number | null;
  status?: LeadFollowupStatus;
  latestActionType?: FollowupActionType | null;
  latestActionSummary?: string | null;
  followUpNote?: string | null;
  rejectionReason?: string | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}) {
  const db = getDb();
  const snapshot = getLeadSnapshot(input.studentId, input.diagnosisId ?? null);
  const now = input.updatedAt ?? nowIso();

  let existing = input.trackingIntentId
    ? db.prepare(`SELECT id FROM followup_leads WHERE tracking_intent_id = ? LIMIT 1`).get(input.trackingIntentId) as { id: number } | undefined
    : undefined;

  if (!existing && input.legacyLeadId) {
    existing = db.prepare(`SELECT id FROM followup_leads WHERE legacy_lead_id = ? LIMIT 1`).get(input.legacyLeadId) as { id: number } | undefined;
  }

  if (!existing) {
    existing = db.prepare(`
      SELECT id
      FROM followup_leads
      WHERE student_id = ?
        AND source_type = ?
        AND COALESCE(source_ref_id, 0) = COALESCE(?, 0)
        AND status IN ('new_intent', 'contacted', 'follow_up_pending')
      ORDER BY id DESC
      LIMIT 1
    `).get(input.studentId, input.sourceType, input.sourceRefId ?? null) as { id: number } | undefined;
  }

  if (existing) {
    const current = db.prepare(`SELECT * FROM followup_leads WHERE id = ? LIMIT 1`).get(existing.id) as any;
    db.prepare(`
      UPDATE followup_leads
      SET tracking_intent_id = ?,
          legacy_lead_id = ?,
          parent_account_id = ?,
          source_type = ?,
          source_ref_id = ?,
          grade = ?,
          subject = ?,
          module = ?,
          latest_evidence_summary = ?,
          latest_block_point = ?,
          weekly_change_summary = ?,
          unstable_step = ?,
          continue_tracking_reason = ?,
          status = ?,
          last_contact_at = ?,
          next_follow_up_at = ?,
          latest_action_type = ?,
          latest_action_summary = ?,
          follow_up_note = ?,
          rejection_reason = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      input.trackingIntentId ?? current.tracking_intent_id ?? null,
      input.legacyLeadId ?? current.legacy_lead_id ?? null,
      input.parentAccountId,
      input.sourceType,
      input.sourceRefId ?? current.source_ref_id ?? null,
      snapshot.grade,
      snapshot.subject,
      snapshot.module,
      snapshot.latestEvidenceSummary,
      snapshot.latestBlockPoint,
      snapshot.weeklyChangeSummary,
      snapshot.unstableStep,
      snapshot.continueTrackingReason,
      input.status ?? normalizeStatus(current.status),
      input.lastContactAt ?? current.last_contact_at ?? null,
      input.nextFollowUpAt ?? current.next_follow_up_at ?? null,
      input.latestActionType ?? current.latest_action_type ?? null,
      input.latestActionSummary ?? current.latest_action_summary ?? null,
      input.followUpNote ?? current.follow_up_note ?? null,
      input.rejectionReason ?? current.rejection_reason ?? null,
      now,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO followup_leads (
      legacy_lead_id, tracking_intent_id, parent_account_id, student_id, source_type, source_ref_id,
      grade, subject, module, latest_evidence_summary, latest_block_point, weekly_change_summary,
      unstable_step, continue_tracking_reason, status, last_contact_at, next_follow_up_at,
      latest_action_type, latest_action_summary, follow_up_note, rejection_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.legacyLeadId ?? null,
    input.trackingIntentId ?? null,
    input.parentAccountId,
    input.studentId,
    input.sourceType,
    input.sourceRefId ?? null,
    snapshot.grade,
    snapshot.subject,
    snapshot.module,
    snapshot.latestEvidenceSummary,
    snapshot.latestBlockPoint,
    snapshot.weeklyChangeSummary,
    snapshot.unstableStep,
    snapshot.continueTrackingReason,
    input.status ?? "new_intent",
    input.lastContactAt ?? null,
    input.nextFollowUpAt ?? null,
    input.latestActionType ?? null,
    input.latestActionSummary ?? null,
    input.followUpNote ?? null,
    input.rejectionReason ?? null,
    input.createdAt ?? now,
    now
  );
  return Number(result.lastInsertRowid);
}

export function ensureFollowupSchema() {
  ensureProductSchema();
  ensureP25Schema();
  ensureA4Schema();
  ensureAdminSchema();
  ensureMembershipSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS followup_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legacy_lead_id INTEGER,
      tracking_intent_id INTEGER,
      parent_account_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_ref_id INTEGER,
      grade TEXT,
      subject TEXT,
      module TEXT,
      latest_evidence_summary TEXT NOT NULL,
      latest_block_point TEXT NOT NULL,
      weekly_change_summary TEXT NOT NULL,
      unstable_step TEXT NOT NULL,
      continue_tracking_reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new_intent',
      last_contact_at TEXT,
      next_follow_up_at TEXT,
      latest_action_type TEXT,
      latest_action_summary TEXT,
      follow_up_note TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_account_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (tracking_intent_id) REFERENCES tracking_intents(id)
    );

    CREATE TABLE IF NOT EXISTS followup_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      operator_user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      note TEXT,
      remind_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES followup_leads(id),
      FOREIGN KEY (operator_user_id) REFERENCES users(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_leads_tracking_intent ON followup_leads(tracking_intent_id) WHERE tracking_intent_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_followup_leads_student_status ON followup_leads(student_id, status, updated_at DESC);
  `);

  ensureColumn("followup_leads", "grade", "grade TEXT");
  ensureColumn("followup_leads", "subject", "subject TEXT");
  ensureColumn("followup_leads", "module", "module TEXT");
  ensureColumn("followup_leads", "latest_evidence_summary", "latest_evidence_summary TEXT NOT NULL DEFAULT ''");
  ensureColumn("followup_leads", "latest_block_point", "latest_block_point TEXT NOT NULL DEFAULT ''");
  ensureColumn("followup_leads", "weekly_change_summary", "weekly_change_summary TEXT NOT NULL DEFAULT ''");
  ensureColumn("followup_leads", "unstable_step", "unstable_step TEXT NOT NULL DEFAULT ''");
  ensureColumn("followup_leads", "continue_tracking_reason", "continue_tracking_reason TEXT NOT NULL DEFAULT ''");
  ensureColumn("followup_leads", "next_follow_up_at", "next_follow_up_at TEXT");
  ensureColumn("followup_leads", "latest_action_type", "latest_action_type TEXT");
  ensureColumn("followup_leads", "latest_action_summary", "latest_action_summary TEXT");
  ensureColumn("followup_leads", "legacy_lead_id", "legacy_lead_id INTEGER");
  ensureColumn("followup_leads", "tracking_intent_id", "tracking_intent_id INTEGER");
}

export function syncFollowupLeadFromResultEvent(input: {
  studentId: number;
  diagnosisId: number;
  eventName: string;
  eventValue?: string | null;
}) {
  ensureFollowupSchema();
  if (input.eventName !== "click_continue_tracking") {
    return null;
  }

  const snapshot = getLeadSnapshot(input.studentId, input.diagnosisId);
  const leadId = upsertLead({
    parentAccountId: snapshot.parentAccountId,
    studentId: input.studentId,
    sourceType: "click_continue_tracking",
    sourceRefId: input.diagnosisId,
    diagnosisId: input.diagnosisId,
    status: "new_intent",
    latestActionSummary: `家长刚从结果页点了继续追踪${input.eventValue ? `：${input.eventValue}` : ""}`
  });
  return leadId;
}

export function syncFollowupLeadFromTrackingIntent(intentId: number) {
  ensureFollowupSchema();
  const db = getDb();
  const row = db.prepare(`
    SELECT ti.id, ti.student_id, ti.diagnosis_id, ti.note, ti.status, s.user_id AS parent_account_id
    FROM tracking_intents ti
    INNER JOIN students s ON s.id = ti.student_id
    WHERE ti.id = ?
    LIMIT 1
  `).get(intentId) as {
    id: number;
    student_id: number;
    diagnosis_id: number | null;
    note: string | null;
    status: string;
    parent_account_id: number;
  } | undefined;

  if (!row) {
    return null;
  }

  return upsertLead({
    trackingIntentId: row.id,
    parentAccountId: row.parent_account_id,
    studentId: row.student_id,
    sourceType: "tracking_intent",
    sourceRefId: row.id,
    diagnosisId: row.diagnosis_id ?? null,
    status: row.status === "activated" ? "activated" : "new_intent",
    followUpNote: row.note ?? null,
    latestActionSummary: row.note ? `家长补了一句：${row.note}` : "家长把继续追踪意向递上来了。"
  });
}

function syncTrackingStateByLead(row: any, status: LeadFollowupStatus) {
  const db = getDb();
  const now = nowIso();
  if (row.tracking_intent_id) {
    if (status === "activated") {
      db.prepare(`UPDATE tracking_intents SET status = 'activated', activated_at = ?, updated_at = ? WHERE id = ?`).run(now, now, row.tracking_intent_id);
      return;
    }
    if (status === "rejected" || status === "not_needed") {
      db.prepare(`UPDATE tracking_intents SET status = 'closed', updated_at = ? WHERE id = ?`).run(now, row.tracking_intent_id);
      return;
    }
    db.prepare(`UPDATE tracking_intents SET status = 'intent_submitted', updated_at = ? WHERE id = ?`).run(now, row.tracking_intent_id);
  }
}

export function recordFollowupAction(input: {
  leadId: number;
  status?: LeadFollowupStatus;
  actionType?: FollowupActionType | null;
  note?: string | null;
  nextFollowUpAt?: string | null;
  rejectionReason?: string | null;
  adminSession: AppSession;
}) {
  ensureFollowupSchema();
  const db = getDb();
  const row = getLeadRow(input.leadId);
  if (!row) {
    throw new Error("followup_lead_not_found");
  }

  const now = nowIso();
  const actionType = input.actionType ?? null;
  const derivedStatus = input.status ?? (actionType ? defaultStatusFromAction(actionType) : normalizeStatus(row.status));
  const shouldTouchContact = actionType === "wechat_contacted" || actionType === "phone_contacted" || actionType === "timeline_sent" || actionType === "advice_sent" || actionType === "activated" || derivedStatus === "contacted" || derivedStatus === "follow_up_pending";
  const lastContactAt = shouldTouchContact ? now : row.last_contact_at ?? null;
  const nextFollowUpAt = input.nextFollowUpAt === undefined ? row.next_follow_up_at ?? null : input.nextFollowUpAt;
  const note = input.note ?? row.follow_up_note ?? null;
  const rejectionReason = derivedStatus === "rejected" || derivedStatus === "not_needed"
    ? (input.rejectionReason ?? row.rejection_reason ?? "这轮家长先不接继续追踪。")
    : null;
  const latestActionSummary = actionType
    ? `${getActionLabel(actionType)}${input.note ? `：${input.note}` : ""}`
    : input.note ?? row.latest_action_summary ?? "这条线索先继续挂着。";

  db.prepare(`
    UPDATE followup_leads
    SET status = ?,
        last_contact_at = ?,
        next_follow_up_at = ?,
        latest_action_type = ?,
        latest_action_summary = ?,
        follow_up_note = ?,
        rejection_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    derivedStatus,
    lastContactAt,
    nextFollowUpAt,
    actionType,
    latestActionSummary,
    note,
    rejectionReason,
    now,
    input.leadId
  );

  if (actionType) {
    db.prepare(`INSERT INTO followup_actions (lead_id, operator_user_id, action_type, note, remind_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      input.leadId,
      input.adminSession.userId,
      actionType,
      input.note ?? null,
      nextFollowUpAt,
      now
    );
  }

  syncTrackingStateByLead(row, derivedStatus);
  if (row.tracking_intent_id && derivedStatus === "activated") {
    activateMembershipFromIntent(row.tracking_intent_id, input.adminSession, note ?? "跟进台手动确认会员生效。");
  } else if (row.tracking_intent_id && (derivedStatus === "rejected" || derivedStatus === "not_needed")) {
    closeMembershipIntent(row.tracking_intent_id, rejectionReason ?? note ?? "这轮跟进先关闭。");
  }

  appendAdminActionLog({
    userId: input.adminSession.userId,
    userRole: input.adminSession.role,
    actionType: "record_followup_action",
    targetType: "followup_lead",
    targetId: input.leadId,
    detail: `${actionType ? getActionLabel(actionType) : "改状态"} / ${derivedStatus}${input.note ? ` / ${input.note}` : ""}${nextFollowUpAt ? ` / 下次提醒 ${nextFollowUpAt}` : ""}`
  });

  return getFollowupLeadById(input.leadId);
}

export function getFollowupLeadById(id: number) {
  ensureFollowupSchema();
  const row = getLeadRow(id);
  if (!row) {
    return null;
  }
  return mapLead(row, listActionsForLead(id));
}

function buildReminderBucket(title: string, items: FollowupLeadDetail[]): FollowupReminderBucket {
  return { title, count: items.length, items: items.slice(0, 6) };
}

export function getFollowupBoardSnapshot(): FollowupBoardSnapshot {
  ensureFollowupSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT fl.*, u.name AS parent_name, u.email AS parent_email, s.name AS student_name
    FROM followup_leads fl
    INNER JOIN users u ON u.id = fl.parent_account_id
    INNER JOIN students s ON s.id = fl.student_id
    ORDER BY datetime(fl.updated_at) DESC, fl.id DESC
  `).all() as any[];

  const items = rows.map((row) => mapLead(row, listActionsForLead(row.id)));
  const columns = Object.fromEntries(FOLLOWUP_STATUSES.map((status) => [status, items.filter((item) => item.status === status)])) as Record<LeadFollowupStatus, FollowupLeadDetail[]>;

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startTomorrow);
  startDayAfter.setDate(startDayAfter.getDate() + 1);

  const reminderBase = items.filter((item) => OPEN_STATUSES.includes(item.status) && item.nextFollowUpAt);
  const overdue = reminderBase.filter((item) => item.nextFollowUpAt && new Date(item.nextFollowUpAt) < startToday);
  const today = reminderBase.filter((item) => item.nextFollowUpAt && new Date(item.nextFollowUpAt) >= startToday && new Date(item.nextFollowUpAt) < startTomorrow);
  const tomorrow = reminderBase.filter((item) => item.nextFollowUpAt && new Date(item.nextFollowUpAt) >= startTomorrow && new Date(item.nextFollowUpAt) < startDayAfter);

  return {
    total: items.length,
    newIntent: columns.new_intent.length,
    contacted: columns.contacted.length,
    followUpPending: columns.follow_up_pending.length,
    activated: columns.activated.length,
    rejected: columns.not_needed.length + columns.rejected.length,
    items,
    columns,
    reminders: {
      today: buildReminderBucket("今天待回访", today),
      tomorrow: buildReminderBucket("明天待回访", tomorrow),
      overdue: buildReminderBucket("已逾期未跟进", overdue)
    },
    templates: FOLLOWUP_TEMPLATES
  };
}

export function getFollowupSummary() {
  const snapshot = getFollowupBoardSnapshot();
  return {
    newIntent: snapshot.newIntent,
    contacted: snapshot.contacted,
    followUpPending: snapshot.followUpPending,
    activated: snapshot.activated,
    rejected: snapshot.rejected,
    total: snapshot.total
  };
}

export function getFollowupSourceLabel(sourceType: string) {
  return sourceLabel(sourceType);
}
