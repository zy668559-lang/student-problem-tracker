import { getDb, getPrimaryStudentId } from "@/lib/db";
import { getEvidenceTimelineDetail } from "@/lib/db/a4";
import { appendAdminActionLog } from "@/lib/db/admin";
import { ensureProductSchema } from "@/lib/db/product";
import type {
  AppSession,
  MembershipAdminSnapshot,
  MembershipBenefitFlags,
  MembershipChangeLog,
  MembershipManagementAction,
  MembershipTier,
  MembershipTierStatus,
  StudentMembershipState
} from "@/lib/types";

type MembershipCapability =
  | "timeline"
  | "continuous_recheck"
  | "weekly_report"
  | "teacher_correction"
  | "targeted_assets";

type MembershipStateDraft = {
  membershipTier: MembershipTier;
  tierStatus: MembershipTierStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  benefitFlags: MembershipBenefitFlags;
  manualOverrideReason: string | null;
};

const DEFAULT_MEMBER_DAYS = 28;
const CAPABILITY_MESSAGES: Record<MembershipCapability, string> = {
  timeline: "证据时间轴从自助会员开始开放。试用这轮先帮你看清主问题，还不接连续证据线。",
  continuous_recheck: "试用这轮只先做 1 次体检，不接连续复检。想继续按周追，就得开到自助会员以上。",
  weekly_report: "试用只先给基础结果，不接连续周报。想看按周变化，得进自助会员以上。",
  teacher_correction: "老师人工纠偏只在陪跑会员里开放。自助会员能自动复检，但老师不会手动下场改。",
  targeted_assets: "定向素材推荐从自助会员开始开放。试用这轮先把主问题看清，不额外给连续素材。"
};

const ACTIVE_BENEFITS: Record<MembershipTier, MembershipBenefitFlags> = {
  trial: {
    diagnosisQuota: 1,
    allowContinuousRecheck: false,
    allowWeeklyReport: false,
    allowTimeline: false,
    allowTargetedAssets: false,
    allowTeacherCorrection: false,
    followupPriority: "normal",
    reminderLevel: "basic",
    actionAdviceLevel: "basic"
  },
  self_service: {
    diagnosisQuota: null,
    allowContinuousRecheck: true,
    allowWeeklyReport: true,
    allowTimeline: true,
    allowTargetedAssets: true,
    allowTeacherCorrection: false,
    followupPriority: "normal",
    reminderLevel: "basic",
    actionAdviceLevel: "basic"
  },
  coaching: {
    diagnosisQuota: null,
    allowContinuousRecheck: true,
    allowWeeklyReport: true,
    allowTimeline: true,
    allowTargetedAssets: true,
    allowTeacherCorrection: true,
    followupPriority: "high",
    reminderLevel: "strong",
    actionAdviceLevel: "strong"
  }
};

function nowIso() {
  return new Date().toISOString();
}

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function parseObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function ensureColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function normalizeTier(value: string | null | undefined, fallback: MembershipTier = "trial"): MembershipTier {
  if (value === "trial" || value === "self_service" || value === "coaching") {
    return value;
  }
  return fallback;
}

function normalizeStatus(value: string | null | undefined, fallback: MembershipTierStatus = "active"): MembershipTierStatus {
  if (value === "active" || value === "pending" || value === "paused" || value === "expired") {
    return value;
  }
  return fallback;
}

function tierRank(tier: MembershipTier) {
  switch (tier) {
    case "coaching":
      return 3;
    case "self_service":
      return 2;
    default:
      return 1;
  }
}

function tierLabel(tier: MembershipTier) {
  switch (tier) {
    case "self_service":
      return "自助会员";
    case "coaching":
      return "陪跑会员";
    default:
      return "试用";
  }
}

function statusLabel(status: MembershipTierStatus) {
  switch (status) {
    case "pending":
      return "待开通";
    case "paused":
      return "已暂停";
    case "expired":
      return "已到期";
    default:
      return "生效中";
  }
}

function getEffectiveTier(tier: MembershipTier, status: MembershipTierStatus) {
  return status === "active" ? tier : "trial";
}

function buildBenefitSummary(tier: MembershipTier) {
  switch (tier) {
    case "self_service":
      return [
        "可以周期上传、看周报、看证据时间轴。",
        "自动复检和定向素材推荐会跟着这条线走。",
        "这档还是以系统自动追踪为主，老师不手动下场纠偏。"
      ];
    case "coaching":
      return [
        "更高频复检、老师人工纠偏、提醒更紧。",
        "家长看到的不只是结果，还会拿到更强的动作建议。",
        "后台跟进会按高优先级挂起，不会跟普通线索一个力度。"
      ];
    default:
      return [
        "只先做 1 次体检，帮你把主问题看清楚。",
        "这轮只给基础结果，不接连续复检和周报。",
        "老师人工纠偏和时间轴证据线都还没开放。"
      ];
  }
}

function buildBenefitFlags(tier: MembershipTier, status: MembershipTierStatus, overrides?: Partial<MembershipBenefitFlags> | null) {
  const effectiveTier = getEffectiveTier(tier, status);
  return {
    ...ACTIVE_BENEFITS[effectiveTier],
    ...(overrides ?? {})
  } satisfies MembershipBenefitFlags;
}

function buildSummary(tier: MembershipTier, status: MembershipTierStatus) {
  if (status === "pending" && tier === "self_service") {
    return "这位孩子已经递上自助会员申请了。现在先按试用边界继续看，等后台手动开通后再接连续周报和自动复检。";
  }
  if (status === "pending" && tier === "coaching") {
    return "这位孩子已经递上陪跑会员申请了。现在先按原边界看，等后台手动开通后老师才会下场人工纠偏。";
  }
  if (status === "paused") {
    return `${tierLabel(tier)}这档目前先暂停了。之前的记录都还在，但连续权益先不往下接。`;
  }
  if (status === "expired") {
    return `${tierLabel(tier)}这档已经到期了。现在先回到试用边界，要继续接就得重新开通。`;
  }
  if (tier === "self_service") {
    return "这位孩子现在已经在自助会员里了。系统会顺着这条线继续给周报、自动复检、素材推荐和时间轴。";
  }
  if (tier === "coaching") {
    return "这位孩子现在已经在陪跑会员里了。除了自动追踪，老师人工纠偏和更高优先级跟进也会一起接上。";
  }
  return "这位孩子现在还是试用。先把主问题看清楚，不直接承诺连续追踪和老师人工纠偏。";
}

function serializeStateForLog(state: StudentMembershipState | null) {
  if (!state) {
    return null;
  }

  return {
    membershipTier: state.membershipTier,
    tierStatus: state.tierStatus,
    effectiveFrom: state.effectiveFrom,
    effectiveTo: state.effectiveTo,
    manualOverrideReason: state.manualOverrideReason
  };
}

function mapStateRow(row: {
  student_id: number;
  membership_tier: string;
  tier_status: string;
  effective_from: string | null;
  effective_to: string | null;
  benefit_flags: string | null;
  manual_override_reason: string | null;
  updated_at: string;
}): StudentMembershipState {
  const membershipTier = normalizeTier(row.membership_tier);
  const tierStatus = normalizeStatus(row.tier_status);
  const benefitFlags = buildBenefitFlags(membershipTier, tierStatus, parseObject<Partial<MembershipBenefitFlags>>(row.benefit_flags, {}));
  const effectiveTier = getEffectiveTier(membershipTier, tierStatus);

  return {
    studentId: row.student_id,
    membershipTier,
    tierStatus,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    benefitFlags,
    manualOverrideReason: row.manual_override_reason,
    updatedAt: row.updated_at,
    tierLabel: tierLabel(membershipTier),
    statusLabel: statusLabel(tierStatus),
    effectiveTier,
    isEffective: tierStatus === "active",
    summary: buildSummary(membershipTier, tierStatus),
    benefitSummary: buildBenefitSummary(effectiveTier)
  };
}

function syncLegacyTrackingState(state: StudentMembershipState) {
  const db = getDb();
  const trackingStatus = state.membershipTier === "coaching" && state.tierStatus === "active"
    ? "active"
    : state.membershipTier === "self_service" && (state.tierStatus === "active" || state.tierStatus === "pending")
      ? "intent"
      : "trial";
  const paidTrackingEnabled = state.membershipTier === "coaching" && state.tierStatus === "active";

  db.prepare(`
    UPDATE trial_access
    SET tracking_status = ?,
        paid_tracking_enabled = ?,
        updated_at = ?
    WHERE student_id = ?
  `).run(trackingStatus, paidTrackingEnabled ? 1 : 0, nowIso(), state.studentId);
}

function deriveLegacyState(studentId: number): MembershipStateDraft {
  const db = getDb();
  const access = db.prepare(`
    SELECT tracking_status, paid_tracking_enabled, updated_at
    FROM trial_access
    WHERE student_id = ?
    LIMIT 1
  `).get(studentId) as {
    tracking_status: string | null;
    paid_tracking_enabled: number;
    updated_at: string | null;
  } | undefined;

  const latestIntent = db.prepare(`
    SELECT ti.status, ti.requested_tier, ti.submitted_at, ti.activated_at
    FROM tracking_intents ti
    WHERE ti.student_id = ?
    ORDER BY datetime(ti.updated_at) DESC, ti.id DESC
    LIMIT 1
  `).get(studentId) as {
    status: string;
    requested_tier: string | null;
    submitted_at: string | null;
    activated_at: string | null;
  } | undefined;

  if (latestIntent?.status === "activated") {
    const membershipTier = normalizeTier(latestIntent.requested_tier, "coaching");
    return {
      membershipTier,
      tierStatus: "active",
      effectiveFrom: latestIntent.activated_at ?? access?.updated_at ?? nowIso(),
      effectiveTo: membershipTier === "trial" ? null : addDays(latestIntent.activated_at ?? nowIso(), DEFAULT_MEMBER_DAYS),
      benefitFlags: buildBenefitFlags(membershipTier, "active"),
      manualOverrideReason: null
    };
  }

  if (access?.paid_tracking_enabled || access?.tracking_status === "active") {
    return {
      membershipTier: "coaching",
      tierStatus: "active",
      effectiveFrom: access.updated_at ?? nowIso(),
      effectiveTo: addDays(access.updated_at ?? nowIso(), DEFAULT_MEMBER_DAYS),
      benefitFlags: buildBenefitFlags("coaching", "active"),
      manualOverrideReason: null
    };
  }

  if (latestIntent?.status === "intent_submitted" || access?.tracking_status === "intent") {
    const membershipTier = normalizeTier(latestIntent?.requested_tier, "self_service");
    return {
      membershipTier,
      tierStatus: "pending",
      effectiveFrom: latestIntent?.submitted_at ?? access?.updated_at ?? nowIso(),
      effectiveTo: membershipTier === "trial" ? null : addDays(latestIntent?.submitted_at ?? nowIso(), DEFAULT_MEMBER_DAYS),
      benefitFlags: buildBenefitFlags(membershipTier, "pending"),
      manualOverrideReason: null
    };
  }

  return {
    membershipTier: "trial",
    tierStatus: "active",
    effectiveFrom: access?.updated_at ?? nowIso(),
    effectiveTo: null,
    benefitFlags: buildBenefitFlags("trial", "active"),
    manualOverrideReason: null
  };
}

function insertMembershipState(studentId: number, draft: MembershipStateDraft) {
  const db = getDb();
  const now = nowIso();
  db.prepare(`
    INSERT INTO student_membership_state (
      student_id, membership_tier, tier_status, effective_from, effective_to,
      benefit_flags, manual_override_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId,
    draft.membershipTier,
    draft.tierStatus,
    draft.effectiveFrom,
    draft.effectiveTo,
    stringify(draft.benefitFlags),
    draft.manualOverrideReason,
    now,
    now
  );
}

function ensureMembershipRow(studentId: number) {
  const db = getDb();
  const row = db.prepare(`SELECT student_id FROM student_membership_state WHERE student_id = ? LIMIT 1`).get(studentId) as { student_id: number } | undefined;
  if (!row) {
    insertMembershipState(studentId, deriveLegacyState(studentId));
  }
}

function expireMembershipIfNeeded(studentId: number) {
  const db = getDb();
  const row = db.prepare(`
    SELECT student_id, membership_tier, tier_status, effective_from, effective_to, benefit_flags, manual_override_reason, updated_at
    FROM student_membership_state
    WHERE student_id = ?
    LIMIT 1
  `).get(studentId) as {
    student_id: number;
    membership_tier: string;
    tier_status: string;
    effective_from: string | null;
    effective_to: string | null;
    benefit_flags: string | null;
    manual_override_reason: string | null;
    updated_at: string;
  } | undefined;

  if (!row || row.tier_status !== "active" || !row.effective_to) {
    return;
  }

  if (new Date(row.effective_to) > new Date()) {
    return;
  }

  db.prepare(`
    UPDATE student_membership_state
    SET tier_status = 'expired',
        updated_at = ?
    WHERE student_id = ?
  `).run(nowIso(), studentId);

  syncLegacyTrackingState(getStudentMembershipState(studentId));
}

function upsertMembershipDraft(studentId: number, draft: MembershipStateDraft) {
  ensureMembershipSchema();
  ensureMembershipRow(studentId);
  const db = getDb();
  const updatedAt = nowIso();
  db.prepare(`
    UPDATE student_membership_state
    SET membership_tier = ?,
        tier_status = ?,
        effective_from = ?,
        effective_to = ?,
        benefit_flags = ?,
        manual_override_reason = ?,
        updated_at = ?
    WHERE student_id = ?
  `).run(
    draft.membershipTier,
    draft.tierStatus,
    draft.effectiveFrom,
    draft.effectiveTo,
    stringify(draft.benefitFlags),
    draft.manualOverrideReason,
    updatedAt,
    studentId
  );

  const state = getStudentMembershipState(studentId);
  syncLegacyTrackingState(state);
  return state;
}

function readMembershipState(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT student_id, membership_tier, tier_status, effective_from, effective_to, benefit_flags, manual_override_reason, updated_at
    FROM student_membership_state
    WHERE student_id = ?
    LIMIT 1
  `).get(studentId) as {
    student_id: number;
    membership_tier: string;
    tier_status: string;
    effective_from: string | null;
    effective_to: string | null;
    benefit_flags: string | null;
    manual_override_reason: string | null;
    updated_at: string;
  } | undefined;
}

function appendMembershipLog(input: {
  studentId: number;
  actorUserId?: number | null;
  actionType: MembershipChangeLog["actionType"];
  beforeState: StudentMembershipState | null;
  afterState: StudentMembershipState | null;
  note?: string | null;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO membership_action_logs (
      student_id, actor_user_id, action_type, before_state, after_state, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.studentId,
    input.actorUserId ?? null,
    input.actionType,
    input.beforeState ? stringify(serializeStateForLog(input.beforeState)) : null,
    input.afterState ? stringify(serializeStateForLog(input.afterState)) : null,
    input.note ?? null,
    nowIso()
  );
}

export function ensureMembershipSchema() {
  ensureProductSchema();
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS student_membership_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      membership_tier TEXT NOT NULL DEFAULT 'trial',
      tier_status TEXT NOT NULL DEFAULT 'active',
      effective_from TEXT,
      effective_to TEXT,
      benefit_flags TEXT NOT NULL DEFAULT '{}',
      manual_override_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS membership_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      action_type TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_membership_logs_student_created
    ON membership_action_logs(student_id, created_at DESC);
  `);

  ensureColumn("tracking_intents", "requested_tier", "requested_tier TEXT DEFAULT 'self_service'");
  db.prepare(`
    UPDATE tracking_intents
    SET requested_tier = CASE
      WHEN requested_tier IS NULL OR requested_tier = '' THEN CASE WHEN status = 'activated' THEN 'coaching' ELSE 'self_service' END
      ELSE requested_tier
    END
  `).run();

  const students = db.prepare(`SELECT id FROM students ORDER BY id ASC`).all() as Array<{ id: number }>;
  for (const student of students) {
    ensureMembershipRow(student.id);
  }
}

export function getStudentMembershipState(studentId = getPrimaryStudentId()) {
  ensureMembershipSchema();
  ensureMembershipRow(studentId);
  expireMembershipIfNeeded(studentId);
  const row = readMembershipState(studentId);
  if (!row) {
    throw new Error(`membership_state_missing:${studentId}`);
  }
  return mapStateRow(row);
}

export function validateMembershipCapability(studentId: number, capability: MembershipCapability) {
  const membership = getStudentMembershipState(studentId);
  const ok = capability === "timeline"
    ? membership.benefitFlags.allowTimeline
    : capability === "continuous_recheck"
      ? membership.benefitFlags.allowContinuousRecheck
      : capability === "weekly_report"
        ? membership.benefitFlags.allowWeeklyReport
        : capability === "teacher_correction"
          ? membership.benefitFlags.allowTeacherCorrection
          : membership.benefitFlags.allowTargetedAssets;

  return {
    ok,
    membership,
    message: ok ? null : CAPABILITY_MESSAGES[capability]
  };
}

export function validateMembershipUploadAllowance(input: { studentId: number; usedCount: number }) {
  const membership = getStudentMembershipState(input.studentId);
  const quota = membership.benefitFlags.diagnosisQuota;
  if (quota !== null && input.usedCount >= quota) {
    return {
      ok: false,
      membership,
      message: "试用这轮只先看 1 次体检。想继续上传、接周报和复检，就得开到自助会员以上。"
    };
  }

  return { ok: true, membership, message: null };
}

export function syncMembershipStateFromLegacyTracking(input: {
  studentId: number;
  trackingStatus?: string | null;
  paidTrackingEnabled?: boolean | null;
  reason?: string | null;
}) {
  ensureMembershipSchema();
  const current = getStudentMembershipState(input.studentId);

  const shouldActivateCoaching = Boolean(input.paidTrackingEnabled) || input.trackingStatus === "active";
  const shouldPendSelfService = input.trackingStatus === "intent" && !shouldActivateCoaching;
  const membershipTier: MembershipTier = shouldActivateCoaching
    ? "coaching"
    : shouldPendSelfService
      ? "self_service"
      : "trial";
  const tierStatus: MembershipTierStatus = shouldActivateCoaching
    ? "active"
    : shouldPendSelfService
      ? "pending"
      : "active";
  const effectiveFrom = tierStatus === "active"
    ? nowIso()
    : current.effectiveFrom ?? nowIso();
  const effectiveTo = membershipTier === "trial"
    ? null
    : addDays(effectiveFrom, DEFAULT_MEMBER_DAYS);

  return upsertMembershipDraft(input.studentId, {
    membershipTier,
    tierStatus,
    effectiveFrom,
    effectiveTo,
    benefitFlags: buildBenefitFlags(membershipTier, tierStatus),
    manualOverrideReason: input.reason ?? current.manualOverrideReason
  });
}

export function requestMembershipFromIntent(intentId: number) {
  ensureMembershipSchema();
  const db = getDb();
  const row = db.prepare(`
    SELECT ti.id, ti.student_id, ti.note, ti.requested_tier, s.user_id AS parent_user_id
    FROM tracking_intents ti
    INNER JOIN students s ON s.id = ti.student_id
    WHERE ti.id = ?
    LIMIT 1
  `).get(intentId) as {
    id: number;
    student_id: number;
    note: string | null;
    requested_tier: string | null;
    parent_user_id: number;
  } | undefined;

  if (!row) {
    return null;
  }

  const requestedTier = normalizeTier(row.requested_tier, "self_service");
  const beforeState = getStudentMembershipState(row.student_id);
  if (beforeState.tierStatus === "active" && tierRank(beforeState.membershipTier) >= tierRank(requestedTier)) {
    return beforeState;
  }

  const afterState = upsertMembershipDraft(row.student_id, {
    membershipTier: requestedTier,
    tierStatus: beforeState.tierStatus === "active" && beforeState.membershipTier === requestedTier ? "active" : "pending",
    effectiveFrom: beforeState.effectiveFrom ?? nowIso(),
    effectiveTo: requestedTier === "trial" ? null : beforeState.effectiveTo ?? addDays(nowIso(), DEFAULT_MEMBER_DAYS),
    benefitFlags: buildBenefitFlags(requestedTier, beforeState.tierStatus === "active" && beforeState.membershipTier === requestedTier ? "active" : "pending"),
    manualOverrideReason: row.note ?? beforeState.manualOverrideReason
  });

  appendMembershipLog({
    studentId: row.student_id,
    actorUserId: row.parent_user_id,
    actionType: "intent_requested",
    beforeState,
    afterState,
    note: row.note ?? `申请 ${tierLabel(requestedTier)}`
  });

  return afterState;
}

export function closeMembershipIntent(intentId: number, note?: string | null) {
  ensureMembershipSchema();
  const db = getDb();
  const row = db.prepare(`
    SELECT ti.student_id, ti.requested_tier, s.user_id AS parent_user_id
    FROM tracking_intents ti
    INNER JOIN students s ON s.id = ti.student_id
    WHERE ti.id = ?
    LIMIT 1
  `).get(intentId) as {
    student_id: number;
    requested_tier: string | null;
    parent_user_id: number;
  } | undefined;

  if (!row) {
    return null;
  }

  const requestedTier = normalizeTier(row.requested_tier, "self_service");
  const beforeState = getStudentMembershipState(row.student_id);
  if (beforeState.membershipTier !== requestedTier || beforeState.tierStatus !== "pending") {
    return beforeState;
  }

  const afterState = upsertMembershipDraft(row.student_id, {
    membershipTier: "trial",
    tierStatus: "active",
    effectiveFrom: beforeState.effectiveFrom ?? nowIso(),
    effectiveTo: null,
    benefitFlags: buildBenefitFlags("trial", "active"),
    manualOverrideReason: note ?? "这轮会员申请先关闭。"
  });

  appendMembershipLog({
    studentId: row.student_id,
    actorUserId: row.parent_user_id,
    actionType: "intent_closed",
    beforeState,
    afterState,
    note: note ?? `关闭 ${tierLabel(requestedTier)} 申请`
  });

  return afterState;
}

export function activateMembershipFromIntent(intentId: number, adminSession: AppSession, note?: string | null) {
  ensureMembershipSchema();
  const db = getDb();
  const row = db.prepare(`
    SELECT student_id, requested_tier
    FROM tracking_intents
    WHERE id = ?
    LIMIT 1
  `).get(intentId) as {
    student_id: number;
    requested_tier: string | null;
  } | undefined;

  if (!row) {
    throw new Error("tracking_intent_not_found");
  }

  const requestedTier = normalizeTier(row.requested_tier, "coaching");
  const beforeState = getStudentMembershipState(row.student_id);
  const startedAt = nowIso();
  const afterState = upsertMembershipDraft(row.student_id, {
    membershipTier: requestedTier,
    tierStatus: "active",
    effectiveFrom: startedAt,
    effectiveTo: requestedTier === "trial" ? null : addDays(startedAt, DEFAULT_MEMBER_DAYS),
    benefitFlags: buildBenefitFlags(requestedTier, "active"),
    manualOverrideReason: note ?? beforeState.manualOverrideReason
  });

  appendMembershipLog({
    studentId: row.student_id,
    actorUserId: adminSession.userId,
    actionType: "intent_activated",
    beforeState,
    afterState,
    note: note ?? `按意向开通 ${tierLabel(requestedTier)}`
  });

  return afterState;
}

export function applyAdminMembershipAction(input: {
  studentId: number;
  action: MembershipManagementAction;
  membershipTier?: MembershipTier;
  effectiveTo?: string | null;
  reason?: string | null;
  adminSession: AppSession;
}) {
  ensureMembershipSchema();
  const beforeState = getStudentMembershipState(input.studentId);
  const targetTier = input.membershipTier ?? beforeState.membershipTier;
  const now = nowIso();

  let draft: MembershipStateDraft;
  if (input.action === "pause") {
    draft = {
      membershipTier: beforeState.membershipTier,
      tierStatus: "paused",
      effectiveFrom: beforeState.effectiveFrom ?? now,
      effectiveTo: beforeState.effectiveTo,
      benefitFlags: buildBenefitFlags(beforeState.membershipTier, "paused"),
      manualOverrideReason: input.reason ?? "后台手动暂停。"
    };
  } else if (input.action === "extend") {
    const nextTier = targetTier;
    const nextStatus: MembershipTierStatus = nextTier === "trial" ? "active" : "active";
    const nextEffectiveTo = nextTier === "trial"
      ? null
      : input.effectiveTo ?? addDays(beforeState.effectiveTo ?? now, DEFAULT_MEMBER_DAYS);
    draft = {
      membershipTier: nextTier,
      tierStatus: nextStatus,
      effectiveFrom: beforeState.effectiveFrom ?? now,
      effectiveTo: nextEffectiveTo,
      benefitFlags: buildBenefitFlags(nextTier, nextStatus),
      manualOverrideReason: input.reason ?? "后台手动延期。"
    };
  } else if (input.action === "downgrade") {
    const downgradedTier = targetTier;
    draft = {
      membershipTier: downgradedTier,
      tierStatus: "active",
      effectiveFrom: now,
      effectiveTo: downgradedTier === "trial" ? null : input.effectiveTo ?? beforeState.effectiveTo ?? addDays(now, DEFAULT_MEMBER_DAYS),
      benefitFlags: buildBenefitFlags(downgradedTier, "active"),
      manualOverrideReason: input.reason ?? "后台手动降级。"
    };
  } else {
    const openedTier = targetTier;
    draft = {
      membershipTier: openedTier,
      tierStatus: "active",
      effectiveFrom: now,
      effectiveTo: openedTier === "trial" ? null : input.effectiveTo ?? addDays(now, DEFAULT_MEMBER_DAYS),
      benefitFlags: buildBenefitFlags(openedTier, "active"),
      manualOverrideReason: input.reason ?? "后台手动开通。"
    };
  }

  const afterState = upsertMembershipDraft(input.studentId, draft);
  appendMembershipLog({
    studentId: input.studentId,
    actorUserId: input.adminSession.userId,
    actionType: input.action,
    beforeState,
    afterState,
    note: input.reason ?? null
  });

  appendAdminActionLog({
    userId: input.adminSession.userId,
    userRole: input.adminSession.role,
    actionType: `membership_${input.action}`,
    targetType: "student_membership_state",
    targetId: input.studentId,
    detail: `before=${beforeState.membershipTier}/${beforeState.tierStatus} after=${afterState.membershipTier}/${afterState.tierStatus} note=${input.reason ?? ""}`
  });

  return afterState;
}

export function getMembershipAdminSnapshot(): MembershipAdminSnapshot {
  ensureMembershipSchema();
  const db = getDb();
  const students = db.prepare(`
    SELECT s.id AS student_id, s.name AS student_name, s.grade, u.name AS parent_name, u.email AS parent_email
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    ORDER BY s.id ASC
  `).all() as Array<{
    student_id: number;
    student_name: string;
    grade: string | null;
    parent_name: string;
    parent_email: string;
  }>;

  const items = students.map((student) => {
    const timeline = getEvidenceTimelineDetail(student.student_id);
    const latestDiagnosis = db.prepare(`
      SELECT d.id
      FROM diagnoses d
      INNER JOIN uploads u ON u.id = d.upload_id
      WHERE u.student_id = ?
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT 1
    `).get(student.student_id) as { id: number } | undefined;
    const latestWeekly = db.prepare(`
      SELECT id
      FROM weekly_reports
      WHERE student_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(student.student_id) as { id: number } | undefined;

    return {
      studentId: student.student_id,
      studentName: student.student_name,
      grade: student.grade,
      parentName: student.parent_name,
      parentEmail: student.parent_email,
      membership: getStudentMembershipState(student.student_id),
      latestDiagnosisId: latestDiagnosis?.id ?? null,
      latestWeeklyReportId: latestWeekly?.id ?? null,
      latestBlockPoint: timeline?.lastProblemSummary ?? "当前主卡点还在继续归拢。",
      weeklyChangeSummary: timeline?.currentChangeSummary ?? "这周的变化先按已有结果继续看。",
      unstableStep: timeline?.unstableItems[0] ?? "这一步现在还没完全站住。"
    };
  });

  const logs = db.prepare(`
    SELECT mal.id, mal.student_id, s.name AS student_name, mal.actor_user_id,
           COALESCE(u.name, '系统') AS actor_name, mal.action_type, mal.before_state,
           mal.after_state, mal.note, mal.created_at
    FROM membership_action_logs mal
    INNER JOIN students s ON s.id = mal.student_id
    LEFT JOIN users u ON u.id = mal.actor_user_id
    ORDER BY datetime(mal.created_at) DESC, mal.id DESC
    LIMIT 16
  `).all() as Array<{
    id: number;
    student_id: number;
    student_name: string;
    actor_user_id: number | null;
    actor_name: string;
    action_type: MembershipChangeLog["actionType"];
    before_state: string | null;
    after_state: string | null;
    note: string | null;
    created_at: string;
  }>;

  return {
    items,
    recentLogs: logs.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      actorUserId: row.actor_user_id ?? 0,
      actorName: row.actor_name,
      actionType: row.action_type,
      beforeState: parseObject(row.before_state, null),
      afterState: parseObject(row.after_state, null),
      note: row.note,
      createdAt: row.created_at
    }))
  };
}
