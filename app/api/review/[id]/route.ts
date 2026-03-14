import { NextResponse } from "next/server";
import {
  appendChangeLog,
  getReviewContext,
  replaceRepairTasksForDiagnosis,
  updateDiagnosisReview,
  upsertWeeklyReport
} from "@/lib/db";
import { generateWeeklyReport } from "@/lib/services/ai";
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
  updateDiagnosisReview(Number(id), parsed, reviewStatus);
  replaceRepairTasksForDiagnosis(
    Number(id),
    context.student_id,
    parsed.subject,
    parsed.module,
    parsed.repair_actions,
    reviewStatus
  );

  const descriptionMap: Record<ReviewStatus, string> = {
    approved: `Review approved: ${parsed.module} diagnosis archived`,
    edited: `Review edited: ${parsed.module} diagnosis updated manually`,
    rejected: `Review rejected: ${parsed.module} diagnosis needs re-check`,
    pending: `Review pending: ${parsed.module}`
  };

  appendChangeLog(
    context.student_id,
    parsed.subject,
    parsed.module,
    reviewStatus,
    descriptionMap[reviewStatus],
    Number(id)
  );

  const weeklyReport = await generateWeeklyReport(context.student_id);
  upsertWeeklyReport(context.student_id, weeklyReport);

  return NextResponse.json({ ok: true });
}