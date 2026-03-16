import { NextResponse } from "next/server";
import { ensureHeartbeatSchema, getHeartbeatSnapshot, runHeartbeatJob } from "@/lib/db/heartbeat";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function GET(request: Request) {
  ensureHeartbeatSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能看 Heartbeat。" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, snapshot: getHeartbeatSnapshot() });
}

export async function POST(request: Request) {
  ensureHeartbeatSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能手动跑 Heartbeat。" }, { status: 403 });
  }

  const result = await runHeartbeatJob({ triggerSource: "admin_manual", adminSession: session });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message ?? "这次 Heartbeat 没跑起来。", snapshot: result.snapshot, recentRun: result.recentRun }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: result.skipped, snapshot: result.snapshot, recentRun: result.recentRun });
}

