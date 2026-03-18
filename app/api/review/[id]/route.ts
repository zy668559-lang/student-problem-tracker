import { NextResponse } from "next/server";
import { appendAdminActionLog } from "@/lib/db/admin";
import { approveReviewDraft, ensureD1Schema, getReviewDraftDetail, updateReviewDraft } from "@/lib/db/d1";
import { rewriteDiagnosisForChenTeacher } from "@/lib/services/tone-chen";
import { parseSessionFromCookieHeader } from "@/lib/session";
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
  ensureD1Schema();
  const { id } = await params;
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || (session.role !== "admin" && session.role !== "reviewer")) {
    return NextResponse.json({ ok: false, message: "这一步只给后台审核位处理。" }, { status: 403 });
  }

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

  const draftId = Number(id);
  const current = getReviewDraftDetail(draftId);
  if (!current) {
    return NextResponse.json({ ok: false, message: "这条草稿我这边没找到。" }, { status: 404 });
  }

  const reviewStatus = mapActionToStatus(body.action);
  const normalizedPayload = rewriteDiagnosisForChenTeacher({
    ...parsed,
    subject: current.subject,
    module: (parsed as DiagnosisPayload).module,
    review_status: reviewStatus
  });

  if (reviewStatus === "approved") {
    const result = await approveReviewDraft({
      draftId,
      payload: normalizedPayload,
      reviewNotes: body.reviewNotes ?? null,
      adminSession: session
    });

    return NextResponse.json({
      ok: true,
      draftId,
      reviewStatus,
      reviewDiff: result.reviewDiff,
      officialDiagnosisId: result.officialDiagnosisId,
      officialWeeklyReportId: result.officialWeeklyReportId,
      recheckTaskId: result.recheckTaskId
    });
  }

  const updated = updateReviewDraft({
    draftId,
    payload: normalizedPayload,
    reviewStatus,
    reviewNotes: body.reviewNotes ?? null
  });
  if (!updated?.detail) {
    return NextResponse.json({ ok: false, message: "这条草稿更新失败了。" }, { status: 500 });
  }

  appendAdminActionLog({
    userId: session.userId,
    userRole: session.role,
    actionType: reviewStatus === "edited" ? "edit_review_draft" : "reject_review_draft",
    targetType: "review_draft",
    targetId: draftId,
    detail: reviewStatus === "edited"
      ? `保存草稿修改：student=${updated.detail.studentId}`
      : `驳回草稿：student=${updated.detail.studentId}`
  });

  return NextResponse.json({
    ok: true,
    draftId,
    reviewStatus,
    reviewDiff: updated.reviewDiff,
    officialDiagnosisId: updated.detail.officialDiagnosisId,
    officialWeeklyReportId: updated.detail.officialWeeklyReportId,
    recheckTaskId: null
  });
}

