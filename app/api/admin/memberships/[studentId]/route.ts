import { NextResponse } from "next/server";
import { ensureHeartbeatSchema, syncHeartbeatForStudent } from "@/lib/db/heartbeat";
import { applyAdminMembershipAction, ensureMembershipSchema } from "@/lib/db/membership";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { MembershipManagementAction, MembershipTier } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ studentId: string }> }) {
  ensureMembershipSchema();
  ensureHeartbeatSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改会员状态。" }, { status: 403 });
  }

  const { studentId } = await context.params;
  const body = (await request.json()) as {
    action?: MembershipManagementAction;
    membershipTier?: MembershipTier;
    effectiveTo?: string | null;
    reason?: string | null;
  };

  if (body.action !== "open" && body.action !== "extend" && body.action !== "downgrade" && body.action !== "pause") {
    return NextResponse.json({ ok: false, message: "这次会员操作类型没选对。" }, { status: 400 });
  }

  if (body.membershipTier && body.membershipTier !== "trial" && body.membershipTier !== "self_service" && body.membershipTier !== "coaching") {
    return NextResponse.json({ ok: false, message: "目标会员层级这次没选对。" }, { status: 400 });
  }

  try {
    const item = applyAdminMembershipAction({
      studentId: Number(studentId),
      action: body.action,
      membershipTier: body.membershipTier,
      effectiveTo: body.effectiveTo ?? null,
      reason: body.reason ?? null,
      adminSession: session
    });
    syncHeartbeatForStudent(item.studentId, "membership_admin");
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, message: "这位孩子的会员状态我这边没改进去。" }, { status: 400 });
  }
}

