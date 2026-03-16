import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  createDiagnosisRecord,
  createRepairTasks,
  createUploadRecord,
  upsertWeeklyReport
} from "@/lib/db";
import { attachWeeklyReportToRecheckTasks, syncRecheckForDiagnosis } from "@/lib/db/recheck";
import { ensureHeartbeatSchema, syncHeartbeatForStudent } from "@/lib/db/heartbeat";
import {
  appendStructuredChangeLog,
  ensureProductSchema,
  enrichDiagnosisRecord,
  recordUploadMeta,
  upsertStudentMemorySummary,
  validateUploadAccess
} from "@/lib/db/product";
import {
  decorateWeeklyPayload,
  ensureP25Schema,
  getRecheckTaskPageDetail,
  persistWeeklyReportArtifacts,
  recordSubmissionMeta
} from "@/lib/db/p25";
import {
  validateMembershipCapability,
  validateMembershipUploadAllowance
} from "@/lib/db/membership";
import { analyzeUpload, generateWeeklyReport } from "@/lib/services/ai";
import { softenUploadError } from "@/lib/services/tone-chen";
import { getActiveStudentId, parseSessionFromCookieHeader } from "@/lib/session";
import type { DiagnosisMode, StepQuality, StuckPointSource, Subject, SubmissionType, TrialAccessSnapshot } from "@/lib/types";

export const runtime = "nodejs";

function inferStepQuality(stepsText: string) {
  const length = stepsText.trim().length;
  if (length === 0) return "none" as StepQuality;
  if (length < 30) return "partial" as StepQuality;
  return "clear" as StepQuality;
}

function inferDiagnosisMode(hasSteps: boolean, stuckPointChoice: string, hasHistory: boolean) {
  if (!hasSteps && !stuckPointChoice) return "quick" as DiagnosisMode;
  if (hasSteps && hasHistory) return "deep" as DiagnosisMode;
  return "standard" as DiagnosisMode;
}

export async function POST(request: Request) {
  ensureProductSchema();
  ensureP25Schema();
  ensureHeartbeatSchema();
  const formData = await request.formData();
  const file = formData.get("file");
  const subject = formData.get("subject");
  const module = formData.get("module");
  const uploadType = formData.get("uploadType");
  const submissionType = formData.get("submissionType") === "recheck" ? "recheck" : "diagnosis" as SubmissionType;
  const recheckTaskId = Number(formData.get("recheckTaskId") || 0) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: softenUploadError("图片为空") }, { status: 400 });
  }

  if (subject !== "math" && subject !== "english") {
    return NextResponse.json({ ok: false, message: "科目这次没对上，我先不给它继续往下跑。" }, { status: 400 });
  }

  if (typeof module !== "string" || !module) {
    return NextResponse.json({ ok: false, message: "模块先选一下，我才能更准地帮你判断。" }, { status: 400 });
  }

  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  const studentId = getActiveStudentId(session);
  const guard = validateUploadAccess(studentId, subject as Subject, 1) as { ok: true; access: TrialAccessSnapshot } | { ok: false; message: string };
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: 403 });
  }
  const membershipAllowance = validateMembershipUploadAllowance({
    studentId,
    usedCount: guard.access.freeTrialUsed
  });
  if (!membershipAllowance.ok) {
    return NextResponse.json({ ok: false, message: membershipAllowance.message }, { status: 403 });
  }
  const canUseContinuousRecheck = validateMembershipCapability(studentId, "continuous_recheck").ok;
  const canUseWeeklyReport = validateMembershipCapability(studentId, "weekly_report").ok;

  const recheckTask = submissionType === "recheck" && recheckTaskId
    ? getRecheckTaskPageDetail(recheckTaskId, studentId)
    : null;
  if (submissionType === "recheck" && !canUseContinuousRecheck) {
    return NextResponse.json({ ok: false, message: "这位孩子当前还在试用边界，暂时不能直接走复检上传。" }, { status: 403 });
  }
  if (submissionType === "recheck" && recheckTaskId && !recheckTask) {
    return NextResponse.json({ ok: false, message: "这条复检任务我这边没对上，先刷新一下页面再试。" }, { status: 404 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const extension = path.extname(file.name) || ".png";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fullPath = path.join(uploadsDir, safeName);
  await fs.writeFile(fullPath, buffer);

  const scoreNote = String(formData.get("scoreNote") || "") || null;
  const note = String(formData.get("note") || "") || null;
  const rawStudentSelfReport = String(formData.get("studentSelfReport") || "") || null;
  const studentSelfReport = submissionType === "recheck" && recheckTask
    ? `复检目标：${recheckTask.tag}。${rawStudentSelfReport ?? ""}`.trim()
    : rawStudentSelfReport;
  const stuckPointChoice = String(formData.get("stuckPointChoice") || "").trim();
  const stepsText = String(formData.get("stepsText") || "").trim();
  const hasSteps = stepsText.length > 0;
  const stepQuality = inferStepQuality(stepsText);
  const hasHistory = guard.access.freeTrialUsed > 0;
  const diagnosisMode = inferDiagnosisMode(hasSteps, stuckPointChoice, hasHistory);

  const uploadId = createUploadRecord({
    studentId,
    subject: subject as Subject,
    module,
    scoreNote,
    note,
    studentSelfReport,
    uploadType: typeof uploadType === "string" && uploadType ? uploadType : submissionType === "recheck" ? "错题回做" : "题图",
    fileName: file.name,
    filePath: `uploads/${safeName}`
  });

  recordUploadMeta(uploadId, {
    stuckPointChoice: stuckPointChoice || null,
    stuckPointSource: stuckPointChoice ? ("student_selected" as StuckPointSource) : ("ai_inferred" as StuckPointSource),
    stepsText: stepsText || null,
    hasSteps,
    stepQuality,
    imageCount: 1,
    diagnosisMode
  });
  recordSubmissionMeta(uploadId, { submissionType, recheckTaskId });

  const diagnosis = await analyzeUpload({
    studentId,
    uploadId,
    subject: subject as Subject,
    module,
    scoreNote,
    note,
    studentSelfReport,
    fileName: file.name,
    fileMimeType: file.type || `image/${extension.replace(/^\./, "")}`,
    imageBase64: buffer.toString("base64"),
    stuckPointChoice: stuckPointChoice || null,
    stuckPointSource: stuckPointChoice ? "student_selected" : "ai_inferred",
    stepsText: stepsText || null,
    hasSteps,
    stepQuality,
    diagnosisMode
  });

  const diagnosisId = createDiagnosisRecord(uploadId, diagnosis);
  enrichDiagnosisRecord(diagnosisId, {
    draftDiagnosis: diagnosis,
    diagnosisMode,
    promptVersion: submissionType === "recheck" ? "diag-recheck-v1" : "diag-v5"
  });
  createRepairTasks(diagnosisId, studentId, diagnosis.subject, diagnosis.module, diagnosis.repair_actions);

  appendStructuredChangeLog({
    studentId,
    subject: diagnosis.subject,
    module: diagnosis.module,
    changeType: submissionType === "recheck" ? "recheck_submission" : "detected",
    description: submissionType === "recheck"
      ? `这次是顺着复检任务继续看：${recheckTask?.tag ?? diagnosis.problem_tags[0] ?? diagnosis.module}`
      : `这次新看出来的主卡点是：${diagnosis.problem_tags[0] ?? diagnosis.module}`,
    relatedDiagnosisId: diagnosisId,
    newIssues: diagnosis.problem_tags,
    unstableIssues: [diagnosis.current_stage],
    repeatedErrorTags: diagnosis.problem_tags.slice(0, 3),
    evidenceSummary: stuckPointChoice
      ? `孩子这次自己选了卡点：${stuckPointChoice}`
      : submissionType === "recheck"
        ? "这次是复检回做，我先按题图、过程和上次问题一起判断。"
        : "这次没选卡点自评，我先按题图和文字自动判断。"
  });

  const recheck = syncRecheckForDiagnosis(diagnosisId);
  if (recheck.task) {
    appendStructuredChangeLog({
      studentId,
      subject: diagnosis.subject,
      module: diagnosis.module,
      changeType: recheck.created ? "recheck_created" : recheck.task.stabilized ? "stabilized" : "recheck_progress",
      description: recheck.recheckSummary,
      relatedDiagnosisId: diagnosisId,
      stabilizedIssues: recheck.task.stabilized ? [recheck.task.tag] : [],
      unstableIssues: recheck.task.stabilized ? [] : [recheck.task.tag],
      repeatedErrorTags: [recheck.task.tag],
      evidenceSummary: recheck.continueTrackingReason,
      recheckTaskId: recheck.task.id,
      repeatCount7d: recheck.task.repeatCount7d,
      repeatCount30d: recheck.task.repeatCount30d,
      lastSeenAt: recheck.task.lastSeenAt,
      lastRecheckAt: recheck.task.lastRecheckAt,
      stabilizedScore: recheck.task.stabilizedScore,
      nextPriority: recheck.nextPriority,
      nextRecheckReason: recheck.nextRecheckReason,
      nextActionType: recheck.nextActionType,
      stabilized: recheck.task.stabilized
    });
  }

  let weeklyReportId: number | null = null;
  if (canUseWeeklyReport) {
    const weeklyBase = await generateWeeklyReport(studentId);
    const weekly = decorateWeeklyPayload(studentId, weeklyBase, "instant");
    weeklyReportId = upsertWeeklyReport(studentId, weekly.payload);
    persistWeeklyReportArtifacts({
      reportId: weeklyReportId,
      mode: "instant",
      studentReportJson: weekly.studentReportJson,
      continueTrackingRecommended: weekly.continueTrackingRecommended,
      batchGeneratedAt: null
    });
    attachWeeklyReportToRecheckTasks(studentId, weeklyReportId);
    upsertStudentMemorySummary(studentId);
  }

  syncHeartbeatForStudent(studentId, submissionType === "recheck" ? "upload_recheck" : "upload_diagnosis");
  return NextResponse.json({ ok: true, diagnosisId, weeklyReportId, recheckTaskId: recheck.task?.id ?? null, submissionType });
}





