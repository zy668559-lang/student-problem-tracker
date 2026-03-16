import { getDb, getPrimaryStudentId } from "@/lib/db";
import { getEvidenceTimelineDetail } from "@/lib/db/a4";
import { getTrackingOfferDetail } from "@/lib/db/a43";
import { listStudentsForUser } from "@/lib/db/admin";
import { getStudentMembershipState } from "@/lib/db/membership";
import { getStudentMemorySummary } from "@/lib/db/product";
import { getPriorityRecheckTask } from "@/lib/db/p25";
import type { MembershipTier, MembershipTierStatus, TrackingStatus } from "@/lib/types";

type BadgeTone = "accent" | "gold" | "rose" | "ink";

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
  currentStatus: string;
  membership: MembershipStatusCard;
  latestDiagnosisId: number | null;
  latestWeeklyReportId: number | null;
  priorityRecheckTaskId: number | null;
  continueTrackingHref: string;
  practiceHref: string;
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

function normalize(text: string | null | undefined, fallback: string) {
  const value = text?.trim();
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
    next_priority: null as string | null
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
    detail: membership.benefitSummary[0] ?? "先顺着这条线继续看。",
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

function getCurrentStatusCopy(input: {
  trackingStatus: TrackingStatus;
  priorityTaskStatus?: string | null;
  unstableStep: string;
  membership: MembershipStatusCard;
}) {
  if (input.membership.tierStatus === "pending") {
    return "这条会员申请已经递上去了。现在先按当前边界继续看，等后台确认后，长线权益才会一起生效。";
  }

  if (input.membership.tierStatus === "paused" || input.membership.tierStatus === "expired") {
    return "这条会员状态现在先停住了。已有记录都在，但长线权益先不继续往下接。";
  }

  if (input.trackingStatus === "active") {
    return "这条现在已经在陪跑会员里，重点不是看会没会，是看稳没稳。";
  }

  if (input.trackingStatus === "intent") {
    return "这条现在已经进自助会员节奏了，周报、自动复检和时间轴都会顺着主线接。";
  }

  if (input.priorityTaskStatus === "stabilized") {
    return "这周有一块先算稳住了，但别一下全松。";
  }

  if (input.priorityTaskStatus === "passed_once" || input.priorityTaskStatus === "improving") {
    return "这条有起色了，但还没到能完全放心的时候。";
  }

  return `这周先别贪多，最该盯的还是：${input.unstableStep}`;
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
    "这条主卡点我还在继续往一起收。"
  );
  const unstableStep = normalize(
    timeline?.unstableItems[0] ?? offer?.unstableStep ?? weekly.unstable_points?.[0],
    "这一步现在最怕看着会了，过两天又掉回去。"
  );
  const thisWeekAction = normalize(
    latestDiagnosis?.student_today_action
      ?? weekly.student_today_action
      ?? latestDiagnosis?.student_minimum_action
      ?? priorityTask?.nextActionType,
    "这周先把最小动作做顺，别一下铺太多。"
  );
  const latestRecheckResult = normalize(
    latestDiagnosis?.recheck_summary ?? memory.recheck_status_summary,
    membership.canUseWeeklyReport
      ? "这条还没到正式记稳的时候，先按这周主线继续盯。"
      : "这轮还是基础体检结果，还没进入连续复检。"
  );
  const weeklyOneLiner = normalize(
    timeline?.currentChangeSummary ?? offer?.weeklyChange ?? weekly.parent_weekly_summary,
    "这周不是完全没动静，是有一点起色，但还得接着看。"
  );
  const nextPriority = normalize(
    timeline?.nextPriority ?? offer?.nextPriority ?? latestDiagnosis?.next_priority ?? weekly.next_priority ?? memory.next_priority,
    membership.canUseWeeklyReport ? "下轮还是先盯最爱反复的那一条。" : "如果要继续追，就先把这次主卡点顺着接下去。"
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
    currentStatus,
    membership,
    latestDiagnosisId,
    latestWeeklyReportId: timeline?.latestWeeklyReportId ?? offer?.latestWeeklyReportId ?? null,
    priorityRecheckTaskId,
    continueTrackingHref,
    practiceHref: priorityRecheckTaskId ? `/recheck/${priorityRecheckTaskId}` : latestDiagnosisId ? `/diagnosis/${latestDiagnosisId}` : "/upload"
  };
}

export function getStudentHomeSnapshot(studentId = getPrimaryStudentId()): StudentHomeSnapshot {
  const summary = buildStudentSummary(studentId);

  return {
    ...summary,
    heroSummary: `${summary.studentName} 这周先别东一榔头西一棒，顺着这一条线往下做最省力。`
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
    tiers: [
      {
        slug: "trial",
        title: "试用",
        highlight: "先把主问题看清楚，不急着谈长期。",
        gets: [
          "只先做 1 次体检，先把主问题看清楚。",
          "能拿到基础结果和这次先做什么，不用自己瞎猜。",
          "这档先不给连续复检、时间轴和老师人工纠偏。"
        ],
        fits: "适合刚进来，先想看清孩子是不是卡在同一个点上的家长。",
        difference: "这是起步层，只负责看明白，不负责把变化连续接 4 周。"
      },
      {
        slug: "self_service",
        title: "自助会员",
        highlight: "你自己推进，我把主线和节奏给你接起来。",
        gets: [
          "可以周期上传、看周报、看证据时间轴，不再只看单次结果。",
          "自动复检和定向素材推荐会跟着这条线继续往下跑。",
          "家长每周都能知道下轮优先级和还没稳的那一步。"
        ],
        fits: "适合家长愿意自己盯执行，但希望系统把主线、节奏和证据先接稳。",
        difference: "比试用多的是连续追踪视角，不再只看一次体检结论。"
      },
      {
        slug: "coaching",
        title: "陪跑会员",
        highlight: "问题、动作、变化和老师人工纠偏都一起接上。",
        gets: [
          "复检、时间轴、周报和继续追踪会按一条线往下接。",
          "老师人工纠偏、高优先级跟进和更紧的提醒会一起生效。",
          "孩子打开就知道今天先练什么，家长也知道这周先盯哪一步。"
        ],
        fits: "适合最担心回弹，想把 4 周变化真正盯住，还想让老师手动下场纠偏的家长。",
        difference: "比自助会员多的是老师人工纠偏和更强的跟进力度，不只是继续自动追。"
      }
    ]
  };
}
