import { NextResponse } from "next/server";
import { ensureA4Schema, updateLeadFollowup } from "@/lib/db/a4";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { LeadFollowupStatus } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureA4Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改跟进状态。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    status?: LeadFollowupStatus;
    followUpNote?: string | null;
    rejectionReason?: string | null;
  };
  const { id } = await context.params;

  if (!body.status) {
    return NextResponse.json({ ok: false, message: "这条跟进还没给状态。" }, { status: 400 });
  }

  try {
    const item = updateLeadFollowup({
      id: Number(id),
      status: body.status,
      followUpNote: body.followUpNote ?? null,
      rejectionReason: body.rejectionReason ?? null,
      adminSession: session
    });
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ ok: false, message: "这条跟进我这边没找到。" }, { status: 404 });
  }
}
