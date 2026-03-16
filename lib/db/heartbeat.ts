import { getDb } from "@/lib/db";
import { appendAdminActionLog, ensureAdminSchema } from "@/lib/db/admin";
import { ensureFollowupSchema } from "@/lib/db/followups";
import { ensureMembershipSchema, getStudentMembershipState } from "@/lib/db/membership";
import type {
  AdminControlCenterQueueItem,
  AppSession,
  HeartbeatEventDetail,
  HeartbeatEventStatus,
  HeartbeatEventType,
  HeartbeatRuleDefinition,
  HeartbeatRunDetail,
  HeartbeatSnapshot
} from "@/lib/types";

type HeartbeatConfigValue = string | number | boolean | null;
type HeartbeatConfig = Record<string, HeartbeatConfigValue>;

type HeartbeatCandidate = {
  ruleKey: string;
  eventType: HeartbeatEventType;
  studentId: number;
  parentAccountId: number;
  summary: string;
  reason: string;
  actionHint: string;
  sourceRefType: string | null;
  sourceRefId: number | null;
  metadata: HeartbeatConfig;
};

type HeartbeatRunStatus = "running" | "success" | "failed";

type StudentBase = {
  studentId: number;
  studentName: string;
  parentAccountId: number;
  parentName: string;
  parentEmail: string;
};

const RUNNING_WINDOW_MINUTES = 10;
const HEARTBEAT_RULES: Array<{
  ruleKey: string;
  title: string;
  description: string;
  eventType: HeartbeatEventType;
  config: HeartbeatConfig;
}> = [
  {
    ruleKey: "student_inactivity",
    title: "学生停滞",
    description: "连续多天未上传时，提醒学生和家长补最近一次作业或复检图。",
    eventType: "student_reminder",
    config: {
      inactivityDays: 2,
      requireExistingUpload: true
    }
  },
  {
    ruleKey: "recheck_overdue",
    title: "复检到期",
    description: "复检任务已到该回头补看时，挂到今日待复检。",
    eventType: "student_recheck",
    config: {
      allowRecheckDueStatus: true
    }
  },
  {
    ruleKey: "repeated_unstable_error",
    title: "高频错因未稳",
    description: "连续重复且没稳住的错因，进入待运营处理。",
    eventType: "operations_attention",
    config: {
      minRepeat7d: 1,
      minRepeat30d: 2
    }
  },
  {
    ruleKey: "parent_followup_pending",
    title: "家长未决策待回访",
    description: "看过证据或收口页后仍未决策，进入待回访。",
    eventType: "parent_followup",
    config: {
      decisionWaitHours: 0,
      respectNextFollowUpAt: true
    }
  }
];

function nowIso() {
  return new Date().toISOString();
}

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function parseConfig(value: string | null | undefined, fallback: HeartbeatConfig): HeartbeatConfig {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter((entry): entry is [string, HeartbeatConfigValue] => {
      const item = entry[1];
      return typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null;
    });
    return Object.fromEntries(entries);
  } catch {
    return fallback;
  }
}

function parseMetadata(value: string | null | undefined) {
  return parseConfig(value, {});
}

function safeNumber(value: HeartbeatConfigValue | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: HeartbeatConfigValue | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function safeDate(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function ensureColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function formatEventLabel(eventName: string) {
  switch (eventName) {
    case "viewed_tracking_offer_complete":
      return "家长把收口页看完了";
    case "opened_tracking_offer":
      return "家长打开了收口页";
    case "click_continue_tracking":
      return "家长从证据页点了继续追踪";
    case "opened_compare_page":
      return "家长打开了结果对比页";
    case "viewed_recheck_result_complete":
      return "家长看完了复检结果";
    case "viewed_result_complete":
      return "家长看完了本次结果页";
    default:
      return eventName;
  }
}

function eventKey(ruleKey: string, studentId: number) {
  return `${ruleKey}:${studentId}`;
}

function queueHrefForType(eventType: HeartbeatEventType, studentId: number) {
  switch (eventType) {
    case "student_recheck":
      return "/admin/recheck-tasks";
    case "parent_followup":
      return `/admin/followups?student=${studentId}`;
    default:
      return `/admin?student=${studentId}`;
  }
}

function queueBadgeForType(eventType: HeartbeatEventType) {
  switch (eventType) {
    case "student_reminder":
      return "待提醒";
    case "student_recheck":
      return "待复检";
    case "parent_followup":
      return "待回访";
    default:
      return "待运营";
  }
}

function mapRule(row: any): HeartbeatRuleDefinition {
  return {
    id: row.id,
    ruleKey: row.rule_key,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    enabled: Boolean(row.enabled),
    config: parseConfig(row.config_json, {}),
    updatedAt: row.updated_at
  };
}

function mapEvent(row: any): HeartbeatEventDetail {
  return {
    id: row.id,
    eventKey: row.event_key,
    ruleKey: row.rule_key,
    eventType: row.event_type,
    status: row.status as HeartbeatEventStatus,
    studentId: row.student_id,
    studentName: row.student_name,
    parentAccountId: row.parent_account_id,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    summary: row.summary,
    reason: row.reason,
    actionHint: row.action_hint,
    sourceRefType: row.source_ref_type ?? null,
    sourceRefId: row.source_ref_id ?? null,
    hitCount: Number(row.hit_count ?? 0),
    firstHitAt: row.first_hit_at,
    lastHitAt: row.last_hit_at,
    resolvedAt: row.resolved_at ?? null,
    metadata: parseMetadata(row.metadata_json)
  };
}

function mapRun(row: any): HeartbeatRunDetail {
  return {
    id: row.id,
    triggerSource: row.trigger_source,
    triggeredBy: row.triggered_by ?? null,
    triggeredByName: row.triggered_by_name ?? null,
    status: row.status as HeartbeatRunStatus,
    studentsScanned: Number(row.students_scanned ?? 0),
    openEventCount: Number(row.open_event_count ?? 0),
    errorMessage: row.error_message ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    createdAt: row.created_at
  };
}

function getStudentBase(studentId: number): StudentBase | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.id AS studentId, s.name AS studentName, u.id AS parentAccountId, u.name AS parentName, u.email AS parentEmail
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
    LIMIT 1
  `).get(studentId) as StudentBase | undefined;
  return row ?? null;
}

function getLastUpload(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT id, subject, module, created_at
    FROM uploads
    WHERE student_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    subject: string;
    module: string;
    created_at: string;
  } | undefined;
}

function getDueRecheckTask(studentId: number, config: HeartbeatConfig) {
  const db = getDb();
  const allowRecheckDueStatus = safeBoolean(config.allowRecheckDueStatus, true);
  return db.prepare(`
    SELECT id, tag, status, due_date, next_priority, next_recheck_reason, continue_tracking_reason, updated_at
    FROM recheck_tasks
    WHERE student_id = ?
      AND status IN ('recheck_due', 'passed_once', 'improving')
      AND (
        due_date IS NOT NULL AND due_date <= date('now', 'localtime')
        OR (${allowRecheckDueStatus ? 1 : 0} = 1 AND status = 'recheck_due')
      )
    ORDER BY
      CASE status
        WHEN 'recheck_due' THEN 0
        WHEN 'improving' THEN 1
        WHEN 'passed_once' THEN 2
        ELSE 3
      END,
      datetime(updated_at) DESC,
      COALESCE(due_date, date(updated_at)) ASC,
      id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    tag: string;
    status: string;
    due_date: string | null;
    next_priority: string | null;
    next_recheck_reason: string | null;
    continue_tracking_reason: string | null;
    updated_at: string;
  } | undefined;
}

function getRepeatedUnstableTask(studentId: number, config: HeartbeatConfig) {
  const db = getDb();
  const minRepeat7d = safeNumber(config.minRepeat7d, 1);
  const minRepeat30d = safeNumber(config.minRepeat30d, 2);
  return db.prepare(`
    SELECT id, tag, status, repeat_count_7d, repeat_count_30d, next_priority, continue_tracking_reason, updated_at
    FROM recheck_tasks
    WHERE student_id = ?
      AND status != 'stabilized'
      AND status != 'dismissed'
      AND stabilized = 0
      AND (repeat_count_30d >= ? OR repeat_count_7d >= ?)
    ORDER BY repeat_count_30d DESC, repeat_count_7d DESC, datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).get(studentId, minRepeat30d, minRepeat7d) as {
    id: number;
    tag: string;
    status: string;
    repeat_count_7d: number;
    repeat_count_30d: number;
    next_priority: string | null;
    continue_tracking_reason: string | null;
    updated_at: string;
  } | undefined;
}

function getLatestFollowupLead(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT id, status, next_follow_up_at, latest_action_summary, source_type, source_ref_id, updated_at
    FROM followup_leads
    WHERE student_id = ?
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    status: string;
    next_follow_up_at: string | null;
    latest_action_summary: string | null;
    source_type: string;
    source_ref_id: number | null;
    updated_at: string;
  } | undefined;
}

function getLatestTrackingIntent(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT id, status, requested_tier, diagnosis_id, updated_at
    FROM tracking_intents
    WHERE student_id = ?
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    status: string;
    requested_tier: string | null;
    diagnosis_id: number | null;
    updated_at: string;
  } | undefined;
}

function getLatestFollowupSignal(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT diagnosis_id, event_name, event_value, created_at
    FROM result_page_events
    WHERE student_id = ?
      AND event_name IN (
        'viewed_tracking_offer_complete',
        'opened_tracking_offer',
        'click_continue_tracking',
        'opened_compare_page',
        'viewed_recheck_result_complete',
        'viewed_result_complete'
      )
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(studentId) as {
    diagnosis_id: number;
    event_name: string;
    event_value: string | null;
    created_at: string;
  } | undefined;
}

function buildInactivityCandidate(base: StudentBase, config: HeartbeatConfig): HeartbeatCandidate | null {
  const membership = getStudentMembershipState(base.studentId);
  if (membership.tierStatus === 'paused') {
    return null;
  }

  const lastUpload = getLastUpload(base.studentId);
  if (!lastUpload && safeBoolean(config.requireExistingUpload, true)) {
    return null;
  }
  if (!lastUpload) {
    return null;
  }

  const inactivityDays = safeNumber(config.inactivityDays, 3);
  const daysWithoutUpload = Math.floor((Date.now() - safeDate(lastUpload.created_at)) / 86_400_000);
  if (daysWithoutUpload < inactivityDays) {
    return null;
  }

  return {
    ruleKey: 'student_inactivity',
    eventType: 'student_reminder',
    studentId: base.studentId,
    parentAccountId: base.parentAccountId,
    summary: `${daysWithoutUpload} 天没上传了，先把这条线重新接上。`,
    reason: `上次上传还停在 ${lastUpload.subject} / ${lastUpload.module}，现在已经连续 ${daysWithoutUpload} 天没有新材料。`,
    actionHint: '先提醒家长和学生补一张最近作业或复检图，别让这条线静掉。',
    sourceRefType: 'upload',
    sourceRefId: lastUpload.id,
    metadata: {
      inactivityDays,
      daysWithoutUpload,
      lastUploadAt: lastUpload.created_at,
      membershipTier: membership.membershipTier
    }
  };
}

function buildRecheckCandidate(base: StudentBase, config: HeartbeatConfig): HeartbeatCandidate | null {
  const task = getDueRecheckTask(base.studentId, config);
  if (!task) {
    return null;
  }

  return {
    ruleKey: 'recheck_overdue',
    eventType: 'student_recheck',
    studentId: base.studentId,
    parentAccountId: base.parentAccountId,
    summary: `今天该回头补复检：${task.tag}`,
    reason: task.next_recheck_reason ?? task.continue_tracking_reason ?? `这条复检已经到该补看的时间了，状态还是 ${task.status}。`,
    actionHint: task.next_priority ?? '先别换线，今天优先把这条复检补回来。',
    sourceRefType: 'recheck_task',
    sourceRefId: task.id,
    metadata: {
      recheckStatus: task.status,
      dueDate: task.due_date,
      tag: task.tag
    }
  };
}

function buildOperationsCandidate(base: StudentBase, config: HeartbeatConfig): HeartbeatCandidate | null {
  const task = getRepeatedUnstableTask(base.studentId, config);
  if (!task) {
    return null;
  }

  return {
    ruleKey: 'repeated_unstable_error',
    eventType: 'operations_attention',
    studentId: base.studentId,
    parentAccountId: base.parentAccountId,
    summary: `高频错因还没稳：${task.tag}`,
    reason: `近 7 天重复 ${task.repeat_count_7d} 次，近 30 天重复 ${task.repeat_count_30d} 次，当前状态还是 ${task.status}。`,
    actionHint: task.next_priority ?? task.continue_tracking_reason ?? '运营和老师先看这条线要不要加提醒或加回访。',
    sourceRefType: 'recheck_task',
    sourceRefId: task.id,
    metadata: {
      repeatCount7d: task.repeat_count_7d,
      repeatCount30d: task.repeat_count_30d,
      tag: task.tag,
      recheckStatus: task.status
    }
  };
}

function buildFollowupCandidate(base: StudentBase, config: HeartbeatConfig): HeartbeatCandidate | null {
  const membership = getStudentMembershipState(base.studentId);
  if (membership.tierStatus === 'active' && membership.membershipTier !== 'trial') {
    return null;
  }

  const latestSignal = getLatestFollowupSignal(base.studentId);
  if (!latestSignal) {
    return null;
  }

  const decisionWaitHours = safeNumber(config.decisionWaitHours, 0);
  if (Date.now() - safeDate(latestSignal.created_at) < decisionWaitHours * 3_600_000) {
    return null;
  }

  const latestIntent = getLatestTrackingIntent(base.studentId);
  const intentMatchesCurrentSignal = latestIntent
    ? latestIntent.diagnosis_id === latestSignal.diagnosis_id || safeDate(latestIntent.updated_at) >= safeDate(latestSignal.created_at)
    : false;
  if (intentMatchesCurrentSignal && (latestIntent?.status === 'activated' || latestIntent?.status === 'closed')) {
    return null;
  }

  const lead = getLatestFollowupLead(base.studentId);
  if (lead && (lead.status === 'activated' || lead.status === 'rejected' || lead.status === 'not_needed')) {
    return null;
  }

  if (safeBoolean(config.respectNextFollowUpAt, true) && lead?.next_follow_up_at && safeDate(lead.next_follow_up_at) > Date.now()) {
    return null;
  }

  const signalLabel = formatEventLabel(latestSignal.event_name);
  return {
    ruleKey: 'parent_followup_pending',
    eventType: 'parent_followup',
    studentId: base.studentId,
    parentAccountId: base.parentAccountId,
    summary: '家长看过证据或收口页后还没决策。',
    reason: lead?.latest_action_summary ?? `${signalLabel}，但目前还没有形成明确决策。`,
    actionHint: '今天顺着证据页或收口页回访一次，确认是继续追踪、暂缓，还是关闭。',
    sourceRefType: 'diagnosis',
    sourceRefId: latestIntent?.diagnosis_id ?? latestSignal.diagnosis_id,
    metadata: {
      latestSignal: latestSignal.event_name,
      latestSignalAt: latestSignal.created_at,
      leadStatus: lead?.status ?? null,
      requestedTier: latestIntent?.requested_tier ?? null
    }
  };
}

function evaluateRule(base: StudentBase, rule: HeartbeatRuleDefinition) {
  switch (rule.ruleKey) {
    case 'student_inactivity':
      return buildInactivityCandidate(base, rule.config);
    case 'recheck_overdue':
      return buildRecheckCandidate(base, rule.config);
    case 'repeated_unstable_error':
      return buildOperationsCandidate(base, rule.config);
    case 'parent_followup_pending':
      return buildFollowupCandidate(base, rule.config);
    default:
      return null;
  }
}

function getActiveRuleDefinitions() {
  const db = getDb();
  const rows = db.prepare(`SELECT rule_key, enabled, config_json FROM heartbeat_rules ORDER BY id ASC`).all() as Array<{
    rule_key: string;
    enabled: number;
    config_json: string | null;
  }>;
  const rowMap = new Map(rows.map((row) => [row.rule_key, row]));

  return HEARTBEAT_RULES.map((rule) => {
    const current = rowMap.get(rule.ruleKey);
    return {
      ruleKey: rule.ruleKey,
      enabled: current ? Boolean(current.enabled) : true,
      config: {
        ...rule.config,
        ...parseConfig(current?.config_json, {})
      }
    };
  });
}

function upsertHeartbeatEvent(candidate: HeartbeatCandidate) {
  const db = getDb();
  const existing = db.prepare(`SELECT id, status, hit_count FROM heartbeat_events WHERE event_key = ? LIMIT 1`).get(eventKey(candidate.ruleKey, candidate.studentId)) as {
    id: number;
    status: HeartbeatEventStatus;
    hit_count: number;
  } | undefined;
  const now = nowIso();

  if (!existing) {
    db.prepare(`
      INSERT INTO heartbeat_events (
        event_key, rule_key, event_type, status, student_id, parent_account_id,
        summary, reason, action_hint, source_ref_type, source_ref_id,
        metadata_json, hit_count, first_hit_at, last_hit_at, resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?, ?)
    `).run(
      eventKey(candidate.ruleKey, candidate.studentId),
      candidate.ruleKey,
      candidate.eventType,
      candidate.studentId,
      candidate.parentAccountId,
      candidate.summary,
      candidate.reason,
      candidate.actionHint,
      candidate.sourceRefType,
      candidate.sourceRefId,
      stringify(candidate.metadata),
      now,
      now,
      now,
      now
    );
    return;
  }

  db.prepare(`
    UPDATE heartbeat_events
    SET event_type = ?,
        status = 'open',
        parent_account_id = ?,
        summary = ?,
        reason = ?,
        action_hint = ?,
        source_ref_type = ?,
        source_ref_id = ?,
        metadata_json = ?,
        hit_count = ?,
        last_hit_at = ?,
        resolved_at = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(
    candidate.eventType,
    candidate.parentAccountId,
    candidate.summary,
    candidate.reason,
    candidate.actionHint,
    candidate.sourceRefType,
    candidate.sourceRefId,
    stringify(candidate.metadata),
    Number(existing.hit_count ?? 0) + 1,
    now,
    now,
    existing.id
  );
}

function resolveHeartbeatEvent(ruleKey: string, studentId: number) {
  const db = getDb();
  db.prepare(`
    UPDATE heartbeat_events
    SET status = 'resolved',
        resolved_at = ?,
        updated_at = ?
    WHERE event_key = ?
      AND status = 'open'
  `).run(nowIso(), nowIso(), eventKey(ruleKey, studentId));
}

function listStudentIds() {
  const db = getDb();
  return (db.prepare(`SELECT id FROM students ORDER BY id ASC`).all() as Array<{ id: number }>).map((item) => item.id);
}

function openEventCount() {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS count FROM heartbeat_events WHERE status = 'open'`).get() as { count: number };
  return row.count;
}

function hasRunningRun() {
  const db = getDb();
  const row = db.prepare(`
    SELECT id
    FROM heartbeat_runs
    WHERE status = 'running'
      AND datetime(started_at) >= datetime('now', ?)
    ORDER BY id DESC
    LIMIT 1
  `).get(`-${RUNNING_WINDOW_MINUTES} minutes`) as { id: number } | undefined;
  return Boolean(row);
}

function createRunningRun(triggerSource: string, adminSession?: AppSession | null) {
  const db = getDb();
  const startedAt = nowIso();
  return Number(db.prepare(`
    INSERT INTO heartbeat_runs (
      trigger_source, triggered_by, status, students_scanned, open_event_count,
      error_message, started_at, finished_at, created_at
    ) VALUES (?, ?, 'running', 0, 0, NULL, ?, NULL, ?)
  `).run(triggerSource, adminSession?.userId ?? null, startedAt, startedAt).lastInsertRowid);
}

function finishRun(runId: number, status: HeartbeatRunStatus, studentsScanned: number, eventCount: number, errorMessage?: string | null) {
  const db = getDb();
  db.prepare(`
    UPDATE heartbeat_runs
    SET status = ?, students_scanned = ?, open_event_count = ?, error_message = ?, finished_at = ?
    WHERE id = ?
  `).run(status, studentsScanned, eventCount, errorMessage ?? null, nowIso(), runId);
}

export function ensureHeartbeatSchema() {
  ensureFollowupSchema();
  ensureMembershipSchema();
  ensureAdminSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS heartbeat_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS heartbeat_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      rule_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      student_id INTEGER NOT NULL,
      parent_account_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      reason TEXT NOT NULL,
      action_hint TEXT NOT NULL,
      source_ref_type TEXT,
      source_ref_id INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      hit_count INTEGER NOT NULL DEFAULT 0,
      first_hit_at TEXT NOT NULL,
      last_hit_at TEXT NOT NULL,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (parent_account_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS heartbeat_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_source TEXT NOT NULL,
      triggered_by INTEGER,
      status TEXT NOT NULL,
      students_scanned INTEGER NOT NULL DEFAULT 0,
      open_event_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (triggered_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_heartbeat_events_type_status
    ON heartbeat_events(event_type, status, last_hit_at DESC);

    CREATE INDEX IF NOT EXISTS idx_heartbeat_events_student_status
    ON heartbeat_events(student_id, status, updated_at DESC);
  `);

  ensureColumn('heartbeat_events', 'metadata_json', "metadata_json TEXT NOT NULL DEFAULT '{}' ");
  ensureColumn('heartbeat_events', 'action_hint', "action_hint TEXT NOT NULL DEFAULT ''");
  ensureColumn('heartbeat_runs', 'students_scanned', 'students_scanned INTEGER NOT NULL DEFAULT 0');
  ensureColumn('heartbeat_runs', 'open_event_count', 'open_event_count INTEGER NOT NULL DEFAULT 0');

  const now = nowIso();
  for (const rule of HEARTBEAT_RULES) {
    const existing = db.prepare(`SELECT id, config_json, enabled FROM heartbeat_rules WHERE rule_key = ? LIMIT 1`).get(rule.ruleKey) as {
      id: number;
      config_json: string;
      enabled: number;
    } | undefined;

    if (!existing) {
      db.prepare(`
        INSERT INTO heartbeat_rules (rule_key, title, description, event_type, enabled, config_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(rule.ruleKey, rule.title, rule.description, rule.eventType, stringify(rule.config), now, now);
      continue;
    }

    db.prepare(`
      UPDATE heartbeat_rules
      SET title = ?, description = ?, event_type = ?, config_json = ?, updated_at = ?
      WHERE id = ?
    `).run(rule.title, rule.description, rule.eventType, stringify({ ...rule.config, ...parseConfig(existing.config_json, {}) }), now, existing.id);
  }
}

export function listHeartbeatRules() {
  ensureHeartbeatSchema();
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM heartbeat_rules ORDER BY id ASC`).all() as any[];
  return rows.map((row) => mapRule(row));
}

export function listOpenHeartbeatEvents(eventType?: HeartbeatEventType, limit = 20) {
  ensureHeartbeatSchema();
  const db = getDb();
  const baseSql = `
    SELECT he.*, s.name AS student_name, u.name AS parent_name, u.email AS parent_email
    FROM heartbeat_events he
    INNER JOIN students s ON s.id = he.student_id
    INNER JOIN users u ON u.id = he.parent_account_id
    WHERE he.status = 'open'
  `;
  const suffix = ` ORDER BY datetime(he.last_hit_at) DESC, he.id DESC LIMIT ?`;
  const rows = eventType
    ? db.prepare(`${baseSql} AND he.event_type = ?${suffix}`).all(eventType, limit) as any[]
    : db.prepare(`${baseSql}${suffix}`).all(limit) as any[];
  return rows.map((row) => mapEvent(row));
}

export function listHeartbeatRuns(limit = 6) {
  ensureHeartbeatSchema();
  const db = getDb();
  const rows = db.prepare(`
    SELECT hr.*, u.name AS triggered_by_name
    FROM heartbeat_runs hr
    LEFT JOIN users u ON u.id = hr.triggered_by
    ORDER BY hr.id DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map((row) => mapRun(row));
}

export function getLatestHeartbeatRun() {
  return listHeartbeatRuns(1)[0] ?? null;
}

export function getHeartbeatSnapshot(): HeartbeatSnapshot {
  return {
    rules: listHeartbeatRules(),
    reminderItems: listOpenHeartbeatEvents('student_reminder', 12),
    recheckItems: listOpenHeartbeatEvents('student_recheck', 12),
    followupItems: listOpenHeartbeatEvents('parent_followup', 12),
    operationsItems: listOpenHeartbeatEvents('operations_attention', 12),
    recentRuns: listHeartbeatRuns(8)
  };
}

export function getHeartbeatQueueItems(eventType: HeartbeatEventType, limit = 6) {
  return listOpenHeartbeatEvents(eventType, limit).map((item) => ({
    studentId: item.studentId,
    studentName: item.studentName,
    parentName: item.parentName,
    parentEmail: item.parentEmail,
    summary: item.summary,
    href: queueHrefForType(eventType, item.studentId),
    badge: queueBadgeForType(eventType),
    createdAt: item.lastHitAt
  })) satisfies AdminControlCenterQueueItem[];
}

export function getHeartbeatOpenCount(eventType: HeartbeatEventType) {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS count FROM heartbeat_events WHERE status = 'open' AND event_type = ?`).get(eventType) as { count: number };
  return row.count;
}

export function syncHeartbeatForStudent(studentId: number, triggerSource = 'in_app') {
  ensureHeartbeatSchema();
  const base = getStudentBase(studentId);
  if (!base) {
    return { studentId, triggerSource, openRuleCount: 0 };
  }

  const rules = getActiveRuleDefinitions();
  const ruleConfigMap = new Map(rules.map((rule) => [rule.ruleKey, rule]));
  const matchedRuleKeys = new Set<string>();
  const candidates = [
    ruleConfigMap.get('student_inactivity')?.enabled
      ? buildInactivityCandidate(base, ruleConfigMap.get('student_inactivity')?.config ?? {})
      : null,
    ruleConfigMap.get('recheck_overdue')?.enabled
      ? buildRecheckCandidate(base, ruleConfigMap.get('recheck_overdue')?.config ?? {})
      : null,
    ruleConfigMap.get('repeated_unstable_error')?.enabled
      ? buildOperationsCandidate(base, ruleConfigMap.get('repeated_unstable_error')?.config ?? {})
      : null,
    ruleConfigMap.get('parent_followup_pending')?.enabled
      ? buildFollowupCandidate(base, ruleConfigMap.get('parent_followup_pending')?.config ?? {})
      : null
  ].filter((candidate): candidate is HeartbeatCandidate => Boolean(candidate));


  for (const candidate of candidates) {
    matchedRuleKeys.add(candidate.ruleKey);
    upsertHeartbeatEvent(candidate);
  }

  for (const rule of rules) {
    if (!matchedRuleKeys.has(rule.ruleKey)) {
      resolveHeartbeatEvent(rule.ruleKey, studentId);
    }
  }

  return { studentId, triggerSource, openRuleCount: matchedRuleKeys.size };
}

export async function runHeartbeatJob(input: { triggerSource: string; adminSession?: AppSession | null }) {
  ensureHeartbeatSchema();
  if (hasRunningRun()) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_running',
      snapshot: getHeartbeatSnapshot(),
      recentRun: getLatestHeartbeatRun()
    };
  }

  const runId = createRunningRun(input.triggerSource, input.adminSession);
  const students = listStudentIds();

  try {
    for (const studentId of students) {
      syncHeartbeatForStudent(studentId, input.triggerSource);
    }

    const eventCount = openEventCount();
    finishRun(runId, 'success', students.length, eventCount, null);

    if (input.adminSession) {
      appendAdminActionLog({
        userId: input.adminSession.userId,
        userRole: input.adminSession.role,
        actionType: 'run_heartbeat_job',
        targetType: 'heartbeat_events',
        targetId: null,
        detail: `Heartbeat Lite manual run: scanned ${students.length} students, ${eventCount} open events.`
      });
    }

    return {
      ok: true,
      skipped: false,
      snapshot: getHeartbeatSnapshot(),
      recentRun: getLatestHeartbeatRun()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'heartbeat_failed';
    finishRun(runId, 'failed', students.length, openEventCount(), message);

    if (input.adminSession) {
      appendAdminActionLog({
        userId: input.adminSession.userId,
        userRole: input.adminSession.role,
        actionType: 'run_heartbeat_job_failed',
        targetType: 'heartbeat_events',
        targetId: null,
        detail: `Heartbeat Lite run failed: ${message}`
      });
    }

    return {
      ok: false,
      skipped: false,
      message,
      snapshot: getHeartbeatSnapshot(),
      recentRun: getLatestHeartbeatRun()
    };
  }
}

export function getHeartbeatTodayQueueSummary() {
  return {
    reminders: getHeartbeatOpenCount('student_reminder'),
    rechecks: getHeartbeatOpenCount('student_recheck'),
    followups: getHeartbeatOpenCount('parent_followup'),
    operations: getHeartbeatOpenCount('operations_attention')
  };
}















