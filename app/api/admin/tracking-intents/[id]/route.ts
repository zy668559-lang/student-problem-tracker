import { NextResponse } from "next/server";
import { ensureA4Schema, syncLeadFollowupFromTrackingIntent } from "@/lib/db/a4";
import { activateTrackingIntent, ensureP25Schema } from "@/lib/db/p25";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureP25Schema();
  ensureA4Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改开通状态。" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const intentId = Number(id);
    activateTrackingIntent(intentId, session);
    syncLeadFollowupFromTrackingIntent(intentId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "这条开通意向我这边没找到。" }, { status: 404 });
  }
}
