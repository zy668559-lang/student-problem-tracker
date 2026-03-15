import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/db";
import { listStudentsForUser } from "@/lib/db/admin";
import { ensureProductSchema, verifyTrialIdentity } from "@/lib/db/product";
import { serializeSessionValue } from "@/lib/session";

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

  const students = listStudentsForUser(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("spt_session", serializeSessionValue({
    userId: user.id,
    role: user.role,
    activeStudentId: students[0]?.id ?? user.student_id ?? null,
    studentIds: students.map((student) => student.id)
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
