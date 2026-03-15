import { NextResponse } from "next/server";
import { listStudentsForUser } from "@/lib/db/admin";
import { parseSessionFromCookieHeader, serializeSessionValue } from "@/lib/session";

export async function POST(request: Request) {
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, message: "登录状态掉了，咱们重新进一下后台。" }, { status: 401 });
  }

  const body = (await request.json()) as { studentId?: number };
  const studentId = Number(body.studentId);
  const students = listStudentsForUser(session.userId);

  if (!Number.isInteger(studentId) || !students.some((student) => student.id === studentId)) {
    return NextResponse.json({ ok: false, message: "这个孩子还没绑在当前家长账号下。" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("spt_session", serializeSessionValue({
    ...session,
    activeStudentId: studentId,
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
