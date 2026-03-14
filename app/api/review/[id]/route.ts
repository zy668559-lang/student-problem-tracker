import { NextResponse } from "next/server";
import {
  appendChangeLog,
  getReviewContext,
  replaceRepairTasksForDiagnosis,
  updateDiagnosisReview,
  upsertWeeklyReport
} from "@/lib/db";
import { upsertMemorySummary } from "@/lib/db/memory";
import { generateWeeklyReport } from "@/lib/services/ai";
import { rewriteDiagnosisForChenTeacher } from "@/lib/services/tone-chen";
import type { DiagnosisPayload, ReviewStatus } from "@/lib/types";

function isValidDiagnosisPayload(value: unknown): value is DiagnosisPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

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
  if (action === "approve") {
    return "approved";
  }
  if (action === "reject") {
    return "rejected";
  }
  return "edited";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { action?: string; payloadText?: string };

  if (!body.action || !body.payloadText) {
    return NextResponse.json({ ok: false, message: "Missing review parameters." }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.payloadText);
  } catch {
    return NextResponse.json({ ok: false, message: "Diagnosis JSON is invalid." }, { status: 400 });
  }

  if (!isValidDiagnosisPayload(parsed)) {
    return NextResponse.json({ ok: false, message: "Diagnosis JSON fields are incomplete." }, { status: 400 });
  }

  const context = getReviewContext(Number(id));
  if (!context) {
    return NextResponse.json({ ok: false, message: "Diagnosis not found." }, { status: 404 });
  }

  const reviewStatus = mapActionToStatus(body.action);
  const normalizedPayload = rewriteDiagnosisForChenTeacher({
    ...parsed,
    review_status: reviewStatus
  });

  updateDiagnosisReview(Number(id), normalizedPayload, reviewStatus);
  replaceRepairTasksForDiagnosis(
    Number(id),
    context.student_id,
    normalizedPayload.subject,
    normalizedPayload.module,
    normalizedPayload.repair_actions,
    reviewStatus
  );

  const descriptionMap: Record<ReviewStatus, string> = {
    approved: `审核通过：${normalizedPayload.module} 已进入正式档案`,
    edited: `审核已修改：${normalizedPayload.module} 已更新成老师确认版本`,
    rejected: `审核驳回：${normalizedPayload.module} 需要重新诊断`,
    pending: `等待审核：${normalizedPayload.module}`
  };

  appendChangeLog(
    context.student_id,
    normalizedPayload.subject,
    normalizedPayload.module,
    reviewStatus,
    descriptionMap[reviewStatus],
    Number(id)
  );

  const weeklyReport = await generateWeeklyReport(context.student_id);
  upsertWeeklyReport(context.student_id, weeklyReport);
  upsertMemorySummary(context.student_id);

  return NextResponse.json({ ok: true });
}
