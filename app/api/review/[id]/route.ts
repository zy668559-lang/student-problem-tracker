import { NextResponse } from "next/server";
import {
  getReviewContext,
  replaceRepairTasksForDiagnosis,
  updateDiagnosisReview,
  upsertWeeklyReport
} from "@/lib/db";
import {
  appendStructuredChangeLog,
  ensureProductSchema,
  storeReviewedDiagnosis,
  upsertStudentMemorySummary
} from "@/lib/db/product";
import { generateWeeklyReport } from "@/lib/services/ai";
import { rewriteDiagnosisForChenTeacher } from "@/lib/services/tone-chen";
import type { DiagnosisPayload, ReviewStatus } from "@/lib/types";

function isValidDiagnosisPayload(value: unknown): value is DiagnosisPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.current_stage === "string" &&
    (payload.subject === "math" || payload.subject === "english") &&
    typeof payload.module === "string" &&
    Array.isArray(payload.problem_tags) &&
    Array.isArray(payload.repair_actions) &&
    typeof payload.parent_summary === "string" &&
    typeof payload.confidence === "number" &&
    typeof payload.review_status === "string"
  );
}

function mapActionToStatus(action: string): ReviewStatus {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return "edited";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureProductSchema();
  const { id } = await params;
  const body = (await request.json()) as { action?: string; payloadText?: string; reviewNotes?: string };

  if (!body.action || !body.payloadText) {
    return NextResponse.json({ ok: false, message: "审核动作和 JSON 这次还没给全。" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.payloadText);
  } catch {
    return NextResponse.json({ ok: false, message: "这段诊断 JSON 还不是完整格式，我先没法入档。" }, { status: 400 });
  }

  if (!isValidDiagnosisPayload(parsed)) {
    return NextResponse.json({ ok: false, message: "这段诊断字段还不齐，我先不往正式档案里写。" }, { status: 400 });
  }

  const context = getReviewContext(Number(id));
  if (!context) {
    return NextResponse.json({ ok: false, message: "这条诊断我这边没找到。" }, { status: 404 });
  }

  const reviewStatus = mapActionToStatus(body.action);
  const normalizedPayload = rewriteDiagnosisForChenTeacher({ ...parsed, review_status: reviewStatus });

  updateDiagnosisReview(Number(id), normalizedPayload, reviewStatus);
  const reviewDiff = storeReviewedDiagnosis(Number(id), normalizedPayload, reviewStatus, body.reviewNotes ?? null);
  replaceRepairTasksForDiagnosis(Number(id), context.student_id, normalizedPayload.subject, normalizedPayload.module, normalizedPayload.repair_actions, reviewStatus);

  appendStructuredChangeLog({
    studentId: context.student_id,
    subject: normalizedPayload.subject,
    module: normalizedPayload.module,
    changeType: reviewStatus,
    description: reviewStatus === "approved"
      ? `这条诊断我先给你通过了，正式档案就按这个版本走。`
      : reviewStatus === "edited"
        ? `这条诊断我先替你改过了，后面家长端看到的是老师确认版。`
        : `这条诊断我先驳回，等下一轮重新判断。`,
    relatedDiagnosisId: Number(id),
    stabilizedIssues: reviewStatus === "approved" ? normalizedPayload.problem_tags.slice(0, 2) : [],
    unstableIssues: reviewStatus === "rejected" ? normalizedPayload.problem_tags.slice(0, 3) : [normalizedPayload.current_stage],
    repeatedErrorTags: normalizedPayload.problem_tags.slice(0, 3),
    evidenceSummary: body.reviewNotes ?? "这次没有额外备注，先按老师确认结果入档。"
  });

  const weeklyReport = await generateWeeklyReport(context.student_id);
  upsertWeeklyReport(context.student_id, weeklyReport);
  upsertStudentMemorySummary(context.student_id);

  return NextResponse.json({ ok: true, reviewDiff });
}
