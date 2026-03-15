import { NextResponse } from "next/server";
import { ensureA4Schema, runWeeklyBatchJob } from "@/lib/db/a4";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  ensureA4Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能跑周报批处理。" }, { status: 403 });
  }

  const result = await runWeeklyBatchJob({ triggerSource: "admin_manual", adminSession: session });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message ?? "这次周报批处理没跑起来。", snapshot: result.snapshot }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: result.skipped, items: result.items ?? [], snapshot: result.snapshot });
}
