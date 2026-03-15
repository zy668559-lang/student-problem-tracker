import { NextResponse } from "next/server";
import { activateTrackingIntent, ensureP25Schema } from "@/lib/db/p25";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureP25Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改开通状态。" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    activateTrackingIntent(Number(id), session);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "这条开通意向我这边没找到。" }, { status: 404 });
  }
}
