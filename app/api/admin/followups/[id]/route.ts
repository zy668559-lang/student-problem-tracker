import { NextResponse } from "next/server";
import { ensureFollowupSchema, recordFollowupAction } from "@/lib/db/followups";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { FollowupActionType, LeadFollowupStatus } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureFollowupSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改跟进 SOP。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    status?: LeadFollowupStatus;
    actionType?: FollowupActionType | null;
    note?: string | null;
    nextFollowUpAt?: string | null;
    rejectionReason?: string | null;
  };
  const { id } = await context.params;

  try {
    const item = recordFollowupAction({
      leadId: Number(id),
      status: body.status,
      actionType: body.actionType ?? null,
      note: body.note ?? null,
      nextFollowUpAt: body.nextFollowUpAt ?? null,
      rejectionReason: body.rejectionReason ?? null,
      adminSession: session
    });
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, message: "这条线索我这边没找到。" }, { status: 404 });
  }
}
