import { NextResponse } from "next/server";
import { listAllRecheckTasks } from "@/lib/db/recheck";
import { ensureProductSchema } from "@/lib/db/product";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function GET(request: Request) {
  ensureProductSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能看复检任务。" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, items: listAllRecheckTasks() });
}
