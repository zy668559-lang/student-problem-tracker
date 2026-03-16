import { NextResponse } from "next/server";
import { applyManualRecheckDecision, ensureP25Schema } from "@/lib/db/p25";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { RecheckManualDecision } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureP25Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改复检任务。" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { decision?: RecheckManualDecision; manualPriority?: string | null; reason?: string | null };
  if (body.decision !== "stabilized" && body.decision !== "unstable" && body.decision !== "bombing") {
    return NextResponse.json({ ok: false, message: "人工处理结果这次没选对。" }, { status: 400 });
  }

  try {
    const result = await applyManualRecheckDecision({
      taskId: Number(id),
      decision: body.decision,
      manualPriority: body.manualPriority ?? null,
      reason: body.reason ?? null,
      adminSession: session
    });
    return NextResponse.json({ ok: true, item: result.task, weeklyReportId: result.weeklyReportId });
  } catch (error) {
    if (error instanceof Error && error.message === "membership_teacher_correction_required") {
      return NextResponse.json({ ok: false, message: "老师人工纠偏只对陪跑会员生效，这位孩子当前还没到这档。" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, message: "这条复检任务我这边没找到。" }, { status: 404 });
  }
}
