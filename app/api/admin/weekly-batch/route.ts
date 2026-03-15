import { NextResponse } from "next/server";
import { appendAdminActionLog } from "@/lib/db/admin";
import { ensureP25Schema, runWeeklyBatchForAllStudents } from "@/lib/db/p25";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  ensureP25Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能跑周报批处理。" }, { status: 403 });
  }

  const items = await runWeeklyBatchForAllStudents();
  appendAdminActionLog({
    userId: session.userId,
    userRole: session.role,
    actionType: "run_weekly_batch",
    targetType: "weekly_reports",
    targetId: null,
    detail: `批处理生成本周周报，共 ${items.length} 个学生。`
  });

  return NextResponse.json({ ok: true, items });
}
