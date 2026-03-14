import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };

  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, message: "请填写邮箱和密码。" }, { status: 400 });
  }

  const user = authenticateUser(body.email, body.password);

  if (!user) {
    return NextResponse.json({ ok: false, message: "账号或密码错误。" }, { status: 401 });
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
