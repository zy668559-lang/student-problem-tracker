import { NextResponse } from "next/server";
import { appendAdminActionLog, ensureAdminSchema, updateTrialAccessAdmin } from "@/lib/db/admin";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { Subject } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureAdminSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改白名单。" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    whitelistEnabled?: boolean;
    freeTrialTotal?: number;
    freeTrialUsed?: number;
    maxImagesPerUpload?: number;
    enabledGrades?: string[];
    enabledSubjects?: Subject[];
    trackingStatus?: string;
    paidTrackingEnabled?: boolean;
  };

  updateTrialAccessAdmin(Number(id), {
    whitelistEnabled: Boolean(body.whitelistEnabled),
    freeTrialTotal: Math.max(0, Number(body.freeTrialTotal ?? 0)),
    freeTrialUsed: Math.max(0, Number(body.freeTrialUsed ?? 0)),
    maxImagesPerUpload: Math.max(1, Number(body.maxImagesPerUpload ?? 1)),
    enabledGrades: Array.isArray(body.enabledGrades) ? body.enabledGrades : [],
    enabledSubjects: Array.isArray(body.enabledSubjects) ? body.enabledSubjects : [],
    trackingStatus: typeof body.trackingStatus === "string" ? body.trackingStatus : undefined,
    paidTrackingEnabled: typeof body.paidTrackingEnabled === "boolean" ? body.paidTrackingEnabled : undefined
  });

  appendAdminActionLog({
    userId: session.userId,
    userRole: session.role,
    actionType: "update_trial_access",
    targetType: "trial_access",
    targetId: Number(id),
    detail: `更新白名单：enabled=${Boolean(body.whitelistEnabled)} total=${Number(body.freeTrialTotal ?? 0)} used=${Number(body.freeTrialUsed ?? 0)} images=${Number(body.maxImagesPerUpload ?? 1)} tracking=${body.trackingStatus ?? "unchanged"}`
  });

  return NextResponse.json({ ok: true });
}
