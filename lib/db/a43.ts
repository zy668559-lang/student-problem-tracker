import { getDb, getPrimaryStudentId, getReviewQueue } from "@/lib/db";
import { getEvidenceTimelineDetail, getWeeklyBatchSchedulerSnapshot } from "@/lib/db/a4";
import { getStudentMemorySummary, getTrialAccessSnapshot } from "@/lib/db/product";
import type {
  AdminControlCenterMetric,
  AdminControlCenterQueueItem,
  AdminControlCenterSnapshot,
  AdminControlCenterStudentDetail,
  TrackingOfferDetail,
  TrackingStatus
} from "@/lib/types";

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function weekStartIso() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function safeDate(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function metric(title: string, subtitle: string, count: number, detail: string): AdminControlCenterMetric {
  return { title, subtitle, count, detail };
}

function queryStudentLeadSummary(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT fl.id, fl.status, fl.latest_block_point, fl.weekly_change_summary, fl.unstable_step,
           fl.continue_tracking_reason, fl.updated_at, u.name AS parent_name, u.email AS parent_email,
           s.name AS student_name
    FROM followup_leads fl
    INNER JOIN users u ON u.id = fl.parent_account_id
    INNER JOIN students s ON s.id = fl.student_id
    WHERE fl.student_id = ?
    ORDER BY datetime(fl.updated_at) DESC, fl.id DESC
    LIMIT 1
  `).get(studentId) as {
    id: number;
    status: string;
    latest_block_point: string;
    weekly_change_summary: string;
    unstable_step: string;
    continue_tracking_reason: string;
    updated_at: string;
    parent_name: string;
    parent_email: string;
    student_name: string;
  } | undefined;
}

function getTrackingStatusForStudent(studentId: number): TrackingStatus {
  const access = getTrialAccessSnapshot(studentId);
  return access.trackingStatus ?? (access.paidTrackingEnabled ? "active" : "trial");
}

export function getTrackingOfferDetail(studentId = getPrimaryStudentId(), diagnosisId?: number | null): TrackingOfferDetail | null {
  const timeline = getEvidenceTimelineDetail(studentId);
  if (!timeline) return null;

  const db = getDb();
  const weeklyRow = timeline.latestWeeklyReportId
    ? db.prepare(`SELECT report_json FROM weekly_reports WHERE id = ? LIMIT 1`).get(timeline.latestWeeklyReportId) as { report_json: string | null } | undefined
    : undefined;
  const weeklyPayload = weeklyRow?.report_json ? JSON.parse(weeklyRow.report_json) as { unstable_points?: string[] } : {};
  const unstableStep = timeline.unstableItems[0] ?? weeklyPayload.unstable_points?.[0] ?? "这一步现在看着有起色，但还没到可以完全放心的时候。";

  return {
    studentId,
    studentName: timeline.studentName,
    diagnosisId: diagnosisId ?? timeline.latestDiagnosisId,
    priorityRecheckTaskId: timeline.priorityRecheckTaskId,
    latestWeeklyReportId: timeline.latestWeeklyReportId,
    currentProblem: timeline.lastProblemSummary,
    weeklyChange: timeline.currentChangeSummary,
    unstableStep,
    nextPriority: timeline.nextPriority,
    continueTrackingReason: timeline.continueTrackingReason,
    trackingStatus: getTrackingStatusForStudent(studentId),
    benefits: [
      "每周我会把问题、动作、变化串成一条证据线，不用再靠感觉判断。",
      "同一类错因会继续盯，能看出到底是真稳了，还是只是这次碰巧做对。",
      "家长这边会持续拿到周总结、下轮优先级和最该盯的那一步。"
    ]
  };
}

function buildQueueItem(input: {
  studentId: number;
  studentName: string;
  parentName: string;
  parentEmail: string;
  summary: string;
  href: string;
  badge: string;
  createdAt: string | null;
}): AdminControlCenterQueueItem {
  return { ...input };
}

function getTodayFollowupItems() {
  const db = getDb();
  const { start, end } = dayBounds();
  const rows = db.prepare(`
    SELECT fl.student_id, s.name AS student_name, u.name AS parent_name, u.email AS parent_email,
           fl.latest_block_point, fl.next_follow_up_at, fl.updated_at, fl.status
    FROM followup_leads fl
    INNER JOIN students s ON s.id = fl.student_id
    INNER JOIN users u ON u.id = fl.parent_account_id
    WHERE fl.status IN ('new_intent', 'contacted', 'follow_up_pending')
    ORDER BY datetime(fl.next_follow_up_at) ASC, datetime(fl.updated_at) DESC
  `).all() as Array<any>;

  return rows.filter((row) => {
    const time = safeDate(row.next_follow_up_at);
    return time > 0 && time < end.getTime() && time >= start.getTime() || (time > 0 && time < start.getTime());
  }).slice(0, 6).map((row) => buildQueueItem({
    studentId: row.student_id,
    studentName: row.student_name,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    summary: row.latest_block_point,
    href: `/admin/followups?student=${row.student_id}`,
    badge: row.status === 'new_intent' ? '新意向' : '今天待回访',
    createdAt: row.next_follow_up_at ?? row.updated_at
  }));
}

function getTodayRecheckItems() {
  const db = getDb();
  const today = dayBounds().end.toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT rt.student_id, s.name AS student_name, u.name AS parent_name, u.email AS parent_email,
           rt.id, rt.tag, rt.next_priority, rt.status, rt.due_date, rt.updated_at
    FROM recheck_tasks rt
    INNER JOIN students s ON s.id = rt.student_id
    INNER JOIN users u ON u.id = s.user_id
    WHERE rt.status IN ('recheck_due', 'passed_once', 'improving')
    ORDER BY datetime(rt.updated_at) DESC, rt.id DESC
  `).all() as Array<any>;

  return rows.filter((row) => !row.due_date || row.due_date <= today).slice(0, 6).map((row) => buildQueueItem({
    studentId: row.student_id,
    studentName: row.student_name,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    summary: row.next_priority || `今天先盯 ${row.tag}`,
    href: `/admin/recheck-tasks`,
    badge: row.status === 'recheck_due' ? '今日待复检' : '继续盯',
    createdAt: row.updated_at
  }));
}

function getTodayReviewItems() {
  const db = getDb();
  const queue = getReviewQueue().filter((item) => item.reviewStatus === 'pending' || item.reviewStatus === 'edited').slice(0, 6);
  return queue.map((item) => {
    const parent = db.prepare(`
      SELECT s.id AS student_id, u.name AS parent_name, u.email AS parent_email
      FROM students s
      INNER JOIN uploads up ON up.student_id = s.id
      INNER JOIN diagnoses d ON d.upload_id = up.id
      INNER JOIN users u ON u.id = s.user_id
      WHERE d.id = ?
      LIMIT 1
    `).get(item.id) as { student_id: number; parent_name: string; parent_email: string } | undefined;
    return buildQueueItem({
      studentId: parent?.student_id ?? 0,
      studentName: item.studentName,
      parentName: parent?.parent_name ?? '家长账号',
      parentEmail: parent?.parent_email ?? '-',
      summary: `${item.subject} / ${item.module} / 置信度 ${(item.confidence * 100).toFixed(0)}%`,
      href: `/diagnosis/${item.id}`,
      badge: '待审核',
      createdAt: item.createdAt
    });
  });
}

function getWeeklyHighIntentItems() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fl.student_id, s.name AS student_name, u.name AS parent_name, u.email AS parent_email,
           fl.latest_evidence_summary, fl.status, fl.updated_at, fl.source_type
    FROM followup_leads fl
    INNER JOIN students s ON s.id = fl.student_id
    INNER JOIN users u ON u.id = fl.parent_account_id
    WHERE datetime(fl.created_at) >= datetime(?)
    ORDER BY
      CASE fl.status
        WHEN 'activated' THEN 0
        WHEN 'follow_up_pending' THEN 1
        WHEN 'contacted' THEN 2
        ELSE 3
      END,
      datetime(fl.updated_at) DESC
    LIMIT 6
  `).all(weekStartIso()) as Array<any>;

  return rows.map((row) => buildQueueItem({
    studentId: row.student_id,
    studentName: row.student_name,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    summary: row.latest_evidence_summary,
    href: `/admin/followups?student=${row.student_id}`,
    badge: row.status === 'activated' ? '已开通' : '高意向',
    createdAt: row.updated_at
  }));
}

function getTodayModelMetric() {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS total_calls, COALESCE(SUM(estimated_cost), 0) AS total_cost
    FROM model_call_logs
    WHERE date(created_at) = date('now', 'localtime')
  `).get() as { total_calls: number; total_cost: number };
  return metric('今日模型成本', '今天先别烧太快', row.total_calls, `今日调用 ${row.total_calls} 次，估算 ¥ ${Number(row.total_cost ?? 0).toFixed(4)}`);
}

function buildSuggestedScript(studentId: number) {
  const lead = queryStudentLeadSummary(studentId);
  if (!lead || lead.status === 'new_intent') {
    return '家长您好，我先不讲一堆大道理。就一句话：这次不是完全不会，是有一个点老反复。我把时间轴证据串好了，您先看这周最该盯哪一步。';
  }
  if (lead.status === 'contacted' || lead.status === 'follow_up_pending') {
    return '这条不是完全没进步，是有起色了，但还没稳。现在最怕的是刚松手，它又掉回去。所以这周别换线，顺着这一个卡点再盯一轮。';
  }
  return '这位孩子已经进继续追踪了，这周就别再讲收口，直接提醒家长先盯还没稳住的那一步。';
}

function getSelectedStudentDetail(studentId: number): AdminControlCenterStudentDetail | null {
  const db = getDb();
  const base = db.prepare(`
    SELECT s.id, s.name AS student_name, u.name AS parent_name, u.email AS parent_email
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
    LIMIT 1
  `).get(studentId) as { id: number; student_name: string; parent_name: string; parent_email: string } | undefined;
  if (!base) return null;

  const timeline = getEvidenceTimelineDetail(studentId);
  const memory = getStudentMemorySummary(studentId);
  const actionRows = db.prepare(`
    SELECT fa.action_type, fa.note, fa.created_at
    FROM followup_actions fa
    INNER JOIN followup_leads fl ON fl.id = fa.lead_id
    WHERE fl.student_id = ?
    ORDER BY datetime(fa.created_at) DESC, fa.id DESC
    LIMIT 4
  `).all(studentId) as Array<{ action_type: string; note: string | null; created_at: string }>;

  return {
    studentId: base.id,
    studentName: base.student_name,
    parentName: base.parent_name,
    parentEmail: base.parent_email,
    currentBlockPoint: timeline?.lastProblemSummary ?? memory.repeated_error_tags[0] ?? '这位孩子当前主卡点还在继续整理。',
    weeklyChangeSummary: timeline?.currentChangeSummary ?? memory.last_best_improvement,
    unstableStep: timeline?.unstableItems[0] ?? memory.repeated_error_tags[0] ?? '这一步还没完全站住。',
    nextPriority: timeline?.nextPriority ?? memory.next_priority,
    recentFollowupActions: actionRows.length > 0
      ? actionRows.map((row) => `${row.action_type}${row.note ? `：${row.note}` : ''}`)
      : ['这位家长最近还没有新的跟进行动。'],
    suggestedFollowupScript: buildSuggestedScript(studentId)
  };
}

export function getAdminControlCenterSnapshot(selectedStudentId?: number | null): AdminControlCenterSnapshot {
  const followupItems = getTodayFollowupItems();
  const recheckItems = getTodayRecheckItems();
  const reviewItems = getTodayReviewItems();
  const highIntentItems = getWeeklyHighIntentItems();
  const scheduler = getWeeklyBatchSchedulerSnapshot();
  const db = getDb();

  const selectedId = selectedStudentId
    ?? followupItems[0]?.studentId
    ?? highIntentItems[0]?.studentId
    ?? recheckItems[0]?.studentId
    ?? reviewItems[0]?.studentId
    ?? (db.prepare(`SELECT id FROM students ORDER BY id ASC LIMIT 1`).get() as { id: number } | undefined)?.id
    ?? null;

  const studentChoices = (db.prepare(`SELECT s.id AS student_id, s.name AS student_name, u.name AS parent_name FROM students s INNER JOIN users u ON u.id = s.user_id ORDER BY s.id ASC`).all() as Array<{ student_id: number; student_name: string; parent_name: string }>).map((row) => ({ studentId: row.student_id, studentName: row.student_name, parentName: row.parent_name }));

  const selectedStudent = selectedId ? getSelectedStudentDetail(selectedId) : null;

  return {
    todayFollowups: metric('今日待回访', '先接住意向家长', followupItems.length, followupItems.length > 0 ? '今天先把该回访的家长接住，别让热度掉下去。' : '今天没有卡在回访上的家长。'),
    todayRechecks: metric('今日待复检', '先盯最容易回弹的点', recheckItems.length, recheckItems.length > 0 ? '这些复检今天最好别拖，越拖越容易失真。' : '今天没有必须立刻补的复检。'),
    todayReviews: metric('今日待审核', '先把诊断过稿', reviewItems.length, reviewItems.length > 0 ? '先把待审核诊断过掉，前台链路才不会卡住。' : '今天没有待审核诊断。'),
    weeklyHighIntent: metric('本周高意向家长', '最可能转成继续追踪', highIntentItems.length, highIntentItems.length > 0 ? '这批家长已经动心了，顺着证据说最容易成交。' : '这周暂时没有明显高意向家长。'),
    weeklyBatchStatus: metric('本周周报状态', '自动调度 + 手动补跑', scheduler.lastReportCount, `最近状态：${scheduler.lastStatus ?? '还没跑'}，最近一次产出 ${scheduler.lastReportCount} 份。`),
    todayModelCost: getTodayModelMetric(),
    quickLinks: [
      { href: '/admin/whitelist', title: '白名单管理', detail: '先看谁能进、谁该停。' },
      { href: '/admin/students', title: '学生管理', detail: '先看档案、记忆和最近变化。' },
      { href: '/admin/recheck-tasks', title: '复检任务', detail: '先处理今天该再检的。' },
      { href: '/admin/assets', title: '素材库', detail: '只维护会被诊断推荐到的素材。' },
      { href: '/admin/followups', title: '跟进漏斗', detail: '谁该联系、谁该回访，一眼看清。' }
    ],
    followupItems,
    recheckItems,
    reviewItems,
    highIntentItems,
    studentChoices,
    selectedStudent,
    selectedStudentId: selectedId
  };
}
