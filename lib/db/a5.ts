import { getDb, getPrimaryStudentId } from "@/lib/db";
import { getEvidenceTimelineDetail } from "@/lib/db/a4";
import { getTrackingOfferDetail } from "@/lib/db/a43";
import { listStudentsForUser } from "@/lib/db/admin";
import { getStudentMembershipState } from "@/lib/db/membership";
import { getStudentMemorySummary } from "@/lib/db/product";
import { getPriorityRecheckTask } from "@/lib/db/p25";
import type { MembershipTier, MembershipTierStatus, TrackingStatus } from "@/lib/types";

type BadgeTone = "accent" | "gold" | "rose" | "ink";
type UiStateTone = "red" | "orange" | "blue" | "green" | "gray";
type CapabilityLevel = "off" | "limited" | "on" | "high";

export interface MembershipStatusCard {
  label: string;
  detail: string;
  tier: MembershipTier;
  tierStatus: MembershipTierStatus;
  tierLabel: "试用" | "自助会员" | "陪跑会员";
  statusLabel: string;
  tone: BadgeTone;
  trackingStatus: TrackingStatus;
  canSeeTimeline: boolean;
  canUseWeeklyReport: boolean;
  canUseTeacherCorrection: boolean;
}

export interface StateBarItem {
  label: string;
  detail: string;
  tone: UiStateTone;
}

export interface WeeklyTrendItem {
  label: string;
  tone: UiStateTone;
  value: number;
  note: string;
}

export interface CapabilityCompareRow {
  label: string;
  trial: CapabilityLevel;
  selfService: CapabilityLevel;
  coaching: CapabilityLevel;
}

export interface StudentRoleShellSummary {
  studentId: number;
  studentName: string;
  grade: string | null;
  school: string | null;
  currentBlockPoint: string;
  thisWeekAction: string;
  latestRecheckResult: string;
  weeklyOneLiner: string;
  nextPriority: string;
  unstableStep: string;
  continueTrackingReason: string;
  currentStatus: string;
  membership: MembershipStatusCard;
  latestDiagnosisId: number | null;
  latestWeeklyReportId: number | null;
  priorityRecheckTaskId: number | null;
  continueTrackingHref: string;
  practiceHref: string;
  parentMainChart: StateBarItem[];
  studentFocusChart: StateBarItem[];
  weeklyTrend: WeeklyTrendItem[];
}

export interface StudentHomeSnapshot extends StudentRoleShellSummary {
  heroSummary: string;
}

export interface ParentOverviewStudentCard extends StudentRoleShellSummary {
  isActive: boolean;
}

export interface ParentOverviewSnapshot {
  activeStudentId: number;
  activeStudent: ParentOverviewStudentCard;
  students: ParentOverviewStudentCard[];
  totalStudents: number;
}

export interface MembershipTierCard {
  slug: "trial" | "self_service" | "coaching";
  title: string;
  highlight: string;
  gets: string[];
  fits: string;
  difference: string;
}

export interface MembershipPageSnapshot {
  studentId: number;
  studentName: string;
  currentBlockPoint: string;
  unstableStep: string;
  weeklyOneLiner: string;
  membership: MembershipStatusCard;
  latestDiagnosisId: number | null;
  continueTrackingHref: string;
  tiers: MembershipTierCard[];
  capabilityRows: CapabilityCompareRow[];
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

function humanizeUiText(text: string | null | undefined) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\b(?:timeline|role-shell|overview|student|membership|heartbeat|followup|closure|recheck|upload)[-_][a-z0-9-]+\b/gi, "")
    .replace(/\b(?:student_id|timeline_key|task_id|diagnosis_id|studentid|timelinekey|taskid|diagnosisid)\b\s*[:：#-]?\s*[a-z0-9-]*/gi, "")
    .replace(/^\s*\d+\s*[：:]\s*/, "")
    .replace(/#\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s，。,；;、:：-]+/, "")
    .replace(/[\s，。,；;、:：-]+$/, "")
    .trim();
}

function normalize(text: string | null | undefined, fallback: string) {
  const value = humanizeUiText(text);
  return value && value.length > 0 ? value : fallback;
}

function parseWeeklyPayload(studentId: number) {
  const db = getDb();
  const row = db.prepare(`
    SELECT report_json
    FROM weekly_reports
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(studentId) as { report_json: string | null } | undefined;

  return parseObject(row?.report_json, {
    parent_weekly_summary: null as string | null,
    student_today_action: null as string | null,
    student_minimum_action: null as string | null,
    unstable_points: [] as string[],
    next_priority: null as string | null,
    continue_tracking_reason: null as string | null
  });
}

function getStudentBase(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, grade, school
    FROM students
    WHERE id = ?
    LIMIT 1
  `).get(studentId) as {
    id: number;
    name: string;
    grade: string | null;
    school: string | null;
  } | undefined;
}

function getLatestDiagnosisMeta(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT d.id, d.student_today_action, d.student_minimum_action, d.recheck_summary, d.next_priority
    FROM diagnoses d
    INNER JOIN uploads u ON u.id = d.upload_id
    WHERE u.student_id = ?
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    student_today_action: string | null;
    student_minimum_action: string | null;
    recheck_summary: string | null;
    next_priority: string | null;
  } | undefined;
}

function getMembershipStatusCard(studentId: number): MembershipStatusCard {
  const membership = getStudentMembershipState(studentId);
  const tone = membership.tierStatus === "paused" || membership.tierStatus === "expired"
    ? "rose"
    : membership.membershipTier === "coaching"
      ? "accent"
      : membership.membershipTier === "self_service"
        ? "gold"
        : "ink";
  const trackingStatus = membership.membershipTier === "coaching" && membership.tierStatus === "active"
    ? "active"
    : membership.membershipTier === "self_service" && (membership.tierStatus === "active" || membership.tierStatus === "pending")
      ? "intent"
      : "trial";

  return {
    label: membership.summary,
    detail: membership.benefitSummary[0] ?? "先把这一条主线接住。",
    tier: membership.membershipTier,
    tierStatus: membership.tierStatus,
    tierLabel: membership.membershipTier === "coaching" ? "陪跑会员" : membership.membershipTier === "self_service" ? "自助会员" : "试用",
    statusLabel: membership.statusLabel,
    tone,
    trackingStatus,
    canSeeTimeline: membership.benefitFlags.allowTimeline,
    canUseWeeklyReport: membership.benefitFlags.allowWeeklyReport,
    canUseTeacherCorrection: membership.benefitFlags.allowTeacherCorrection
  };
}

function stateToneClass(status: string | null | undefined): UiStateTone {
  if (!status) {
    return "gray";
  }
  if (status === "stabilized") {
    return "green";
  }
  if (status === "passed_once" || status === "improving") {
    return "orange";
  }
  if (status === "recheck_due") {
    return "blue";
  }
  return "gray";
}

function getCurrentStatusCopy(input: {
  trackingStatus: TrackingStatus;
  priorityTaskStatus?: string | null;
  unstableStep: string;
  membership: MembershipStatusCard;
}) {
  if (input.membership.tierStatus === "pending") {
    return "会员申请已经递上去了，先把这条线继续接着看。";
  }

  if (input.membership.tierStatus === "paused" || input.membership.tierStatus === "expired") {
    return "这条会员状态先停住了，但之前的证据线还在。";
  }

  if (input.trackingStatus === "active") {
    return "现在重点不是会不会，是这条线到底稳没稳。";
  }

  if (input.trackingStatus === "intent") {
    return "这条已经进入持续追踪节奏了，接下来别断线。";
  }

  if (input.priorityTaskStatus === "stabilized") {
    return "这周有一块算稳住了，但别一下全松。";
  }

  if (input.priorityTaskStatus === "passed_once" || input.priorityTaskStatus === "improving") {
    return "开始有变化了，但还没到能放心的时候。";
  }

  return `这周先别贪多，先盯住“${input.unstableStep}”。`;
}

function buildContinueTrackingHref(studentId: number, diagnosisId: number | null, taskId: number | null, source: string) {
  const query = new URLSearchParams();
  query.set("from", source);

  if (diagnosisId) {
    query.set("diagnosisId", String(diagnosisId));
  }

  if (taskId) {
    query.set("taskId", String(taskId));
  }

  return diagnosisId ? `/continue-tracking?${query.toString()}` : `/membership?student=${studentId}`;
}

function startOfWeek(offsetWeeks: number) {
  const now = new Date();
  const start = new Date(now);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day - offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWeekLabel(value: Date) {
  return `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`;
}

function getWeeklyTrend(studentId: number): WeeklyTrendItem[] {
  const db = getDb();
  const rows: WeeklyTrendItem[] = [];

  for (let offset = 3; offset >= 0; offset -= 1) {
    const start = startOfWeek(offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN change_type IN ('stabilized') THEN 1 ELSE 0 END) AS stabilized_count,
        SUM(CASE WHEN change_type IN ('improved', 'approved', 'recheck_progress') THEN 1 ELSE 0 END) AS forward_count,
        SUM(CASE WHEN change_type IN ('unstable', 'rejected', 'detected') THEN 1 ELSE 0 END) AS warning_count
      FROM change_logs
      WHERE student_id = ?
        AND datetime(created_at) >= datetime(?)
        AND datetime(created_at) < datetime(?)
    `).get(studentId, start.toISOString(), end.toISOString()) as {
      stabilized_count: number | null;
      forward_count: number | null;
      warning_count: number | null;
    };

    const stabilizedCount = Number(row.stabilized_count ?? 0);
    const forwardCount = Number(row.forward_count ?? 0);
    const warningCount = Number(row.warning_count ?? 0);
    const total = stabilizedCount + forwardCount + warningCount;
    const tone: UiStateTone = stabilizedCount > 0
      ? "green"
      : forwardCount > warningCount && total > 0
        ? "blue"
        : warningCount > 0
          ? offset === 0 ? "red" : "orange"
          : "gray";

    rows.push({
      label: formatWeekLabel(start),
      tone,
      value: Math.min(Math.max(total, 1), 4),
      note: stabilizedCount > 0
        ? `稳住 ${stabilizedCount} 项`
        : forwardCount > warningCount && total > 0
          ? `这周在往前推`
          : warningCount > 0
            ? `这周还有反复`
            : "还没形成新变化"
    });
  }

  return rows;
}

function buildParentMainChart(input: {
  currentBlockPoint: string;
  thisWeekAction: string;
  unstableStep: string;
  latestRecheckResult: string;
  priorityTaskStatus: string | null;
}): StateBarItem[] {
  return [
    {
      label: "当前最卡",
      detail: input.currentBlockPoint,
      tone: "red"
    },
    {
      label: "这周推进",
      detail: input.thisWeekAction,
      tone: "blue"
    },
    {
      label: "还没稳",
      detail: input.unstableStep,
      tone: "orange"
    },
    {
      label: "复检状态",
      detail: input.latestRecheckResult,
      tone: stateToneClass(input.priorityTaskStatus)
    }
  ];
}

function buildStudentFocusChart(input: {
  thisWeekAction: string;
  latestRecheckResult: string;
  nextPriority: string;
  priorityTaskStatus: string | null;
}): StateBarItem[] {
  return [
    {
      label: "今天先练",
      detail: input.thisWeekAction,
      tone: "red"
    },
    {
      label: "本周重点",
      detail: input.nextPriority,
      tone: "blue"
    },
    {
      label: "稳住情况",
      detail: input.latestRecheckResult,
      tone: stateToneClass(input.priorityTaskStatus)
    }
  ];
}

function getCapabilityRows(): CapabilityCompareRow[] {
  return [
    { label: "连续复检", trial: "off", selfService: "on", coaching: "high" },
    { label: "每周周报", trial: "off", selfService: "on", coaching: "high" },
    { label: "证据时间轴", trial: "off", selfService: "on", coaching: "high" },
    { label: "定向素材", trial: "off", selfService: "on", coaching: "high" },
    { label: "老师纠偏", trial: "off", selfService: "off", coaching: "high" },
    { label: "提醒力度", trial: "limited", selfService: "on", coaching: "high" }
  ];
}

function buildStudentSummary(studentId: number): StudentRoleShellSummary {
  const base = getStudentBase(studentId);
  if (!base) {
    throw new Error(`student ${studentId} not found`);
  }

  const timeline = getEvidenceTimelineDetail(studentId);
  const offer = getTrackingOfferDetail(studentId);
  const weekly = parseWeeklyPayload(studentId);
  const memory = getStudentMemorySummary(studentId);
  const priorityTask = getPriorityRecheckTask(studentId);
  const latestDiagnosis = getLatestDiagnosisMeta(studentId);
  const membership = getMembershipStatusCard(studentId);

  const currentBlockPoint = normalize(
    timeline?.lastProblemSummary,
    "主卡点我先帮你收成这一条，先别分心。"
  );
  const unstableStep = normalize(
    timeline?.unstableItems[0] ?? offer?.unstableStep ?? weekly.unstable_points?.[0],
    "这一步最怕看着会了，过两天又掉回去。"
  );
  const thisWeekAction = normalize(
    latestDiagnosis?.student_today_action
      ?? weekly.student_today_action
      ?? latestDiagnosis?.student_minimum_action
      ?? priorityTask?.nextActionType,
    "今天先把这一步练顺，不要一口气铺太多。"
  );
  const latestRecheckResult = normalize(
    latestDiagnosis?.recheck_summary ?? memory.recheck_status_summary,
    membership.canUseWeeklyReport
      ? "开始有变化了，但还得继续看。"
      : "这轮先拿到一次清楚结果，再决定要不要继续追。"
  );
  const weeklyOneLiner = normalize(
    timeline?.currentChangeSummary ?? offer?.weeklyChange ?? weekly.parent_weekly_summary,
    "这周不是完全没动静，是有一点起色，但还没稳。"
  );
  const nextPriority = normalize(
    timeline?.nextPriority ?? offer?.nextPriority ?? latestDiagnosis?.next_priority ?? weekly.next_priority ?? memory.next_priority,
    membership.canUseWeeklyReport ? "下轮还是先盯最爱反复的这一条。" : "如果要继续追，就先把这次主卡点顺着接下去。"
  );
  const continueTrackingReason = normalize(
    offer?.continueTrackingReason ?? weekly.continue_tracking_reason ?? memory.next_priority,
    "因为这条线开始有变化了，但还没到能放心松手的时候。"
  );
  const currentStatus = getCurrentStatusCopy({
    trackingStatus: membership.trackingStatus,
    priorityTaskStatus: priorityTask?.status ?? null,
    unstableStep,
    membership
  });
  const latestDiagnosisId = timeline?.latestDiagnosisId ?? offer?.diagnosisId ?? latestDiagnosis?.id ?? null;
  const priorityRecheckTaskId = timeline?.priorityRecheckTaskId ?? offer?.priorityRecheckTaskId ?? priorityTask?.id ?? null;
  const continueTrackingHref = buildContinueTrackingHref(studentId, latestDiagnosisId, priorityRecheckTaskId, "role-shell");

  return {
    studentId,
    studentName: base.name,
    grade: base.grade,
    school: base.school,
    currentBlockPoint,
    thisWeekAction,
    latestRecheckResult,
    weeklyOneLiner,
    nextPriority,
    unstableStep,
    continueTrackingReason,
    currentStatus,
    membership,
    latestDiagnosisId,
    latestWeeklyReportId: timeline?.latestWeeklyReportId ?? offer?.latestWeeklyReportId ?? null,
    priorityRecheckTaskId,
    continueTrackingHref,
    practiceHref: priorityRecheckTaskId ? `/recheck/${priorityRecheckTaskId}` : latestDiagnosisId ? `/diagnosis/${latestDiagnosisId}` : "/upload",
    parentMainChart: buildParentMainChart({
      currentBlockPoint,
      thisWeekAction,
      unstableStep,
      latestRecheckResult,
      priorityTaskStatus: priorityTask?.status ?? null
    }),
    studentFocusChart: buildStudentFocusChart({
      thisWeekAction,
      latestRecheckResult,
      nextPriority,
      priorityTaskStatus: priorityTask?.status ?? null
    }),
    weeklyTrend: getWeeklyTrend(studentId)
  };
}

export function getStudentHomeSnapshot(studentId = getPrimaryStudentId()): StudentHomeSnapshot {
  const summary = buildStudentSummary(studentId);

  return {
    ...summary,
    heroSummary: `先把“${summary.thisWeekAction}”做顺。`
  };
}

export function getParentOverviewSnapshot(userId: number, activeStudentId: number): ParentOverviewSnapshot {
  const students = listStudentsForUser(userId);
  const items = students.map((student) => ({
    ...buildStudentSummary(student.id),
    isActive: student.id === activeStudentId
  }));
  const activeStudent = items.find((item) => item.isActive) ?? items[0];

  if (!activeStudent) {
    throw new Error(`user ${userId} has no students`);
  }

  return {
    activeStudentId: activeStudent.studentId,
    activeStudent,
    students: items,
    totalStudents: items.length
  };
}

export function getMembershipPageSnapshot(studentId = getPrimaryStudentId()): MembershipPageSnapshot {
  const summary = buildStudentSummary(studentId);

  return {
    studentId: summary.studentId,
    studentName: summary.studentName,
    currentBlockPoint: summary.currentBlockPoint,
    unstableStep: summary.unstableStep,
    weeklyOneLiner: summary.weeklyOneLiner,
    membership: summary.membership,
    latestDiagnosisId: summary.latestDiagnosisId,
    continueTrackingHref: summary.continueTrackingHref,
    capabilityRows: getCapabilityRows(),
    tiers: [
      {
        slug: "trial",
        title: "试用",
        highlight: "先看清主问题，不急着承诺长期。",
        gets: [
          "先看清孩子到底卡在哪。",
          "知道这次先做什么，不再靠猜。",
          "先不给连续复检、时间轴和老师纠偏。"
        ],
        fits: "适合刚进来，先想看清这条问题线值不值得继续追的家长。",
        difference: "这一档负责看明白，不负责把变化连续接四周。"
      },
      {
        slug: "self_service",
        title: "自助会员",
        highlight: "你自己推进，我把主线和节奏接起来。",
        gets: [
          "可以继续上传、看周报、看时间轴。",
          "自动复检和定向素材会顺着同一条线往下接。",
          "家长能每周看到下一步和还没稳的那一步。"
        ],
        fits: "适合愿意自己执行，但不想每周重新判断重点的家长。",
        difference: "比试用多的是持续追踪，不再只看一次结果。"
      },
      {
        slug: "coaching",
        title: "陪跑会员",
        highlight: "问题、动作、变化和老师纠偏一起接上。",
        gets: [
          "复检、周报、时间轴和继续追踪一条线走到底。",
          "老师人工纠偏和更紧的提醒会一起生效。",
          "孩子知道今天先练什么，家长知道这周先盯哪一步。"
        ],
        fits: "适合最怕回弹、想把 4 周变化盯住，还希望老师下场纠偏的家长。",
        difference: "比自助会员多的是老师下场和更强的跟进力度。"
      }
    ]
  };
}
