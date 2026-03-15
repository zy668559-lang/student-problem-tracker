import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/db";
import { ensureProductSchema, verifyTrialIdentity } from "@/lib/db/product";

export async function POST(request: Request) {
  ensureProductSchema();
  const body = (await request.json()) as { email?: string; password?: string; phone?: string; inviteCode?: string };

  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, message: "邮箱和密码先填上，我这边才能帮你开门。" }, { status: 400 });
  }

  const user = authenticateUser(body.email, body.password);

  if (!user) {
    return NextResponse.json({ ok: false, message: "账号信息这次没对上，咱们再核一眼。" }, { status: 401 });
  }

  if (!verifyTrialIdentity(user.id, body.phone ?? null, body.inviteCode ?? null)) {
    return NextResponse.json({ ok: false, message: "白名单手机号或邀请码这次没对上，我先不给你放行。" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("spt_session", JSON.stringify({
    userId: user.id,
    role: user.role,
    studentId: user.student_id
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
