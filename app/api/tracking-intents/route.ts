import { NextResponse } from "next/server";
import { appendResultPageEvent, ensureProductSchema } from "@/lib/db/product";
import { createTrackingIntent, ensureP25Schema } from "@/lib/db/p25";
import { getActiveStudentId, parseSessionFromCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  ensureProductSchema();
  ensureP25Schema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  const studentId = getActiveStudentId(session);
  const body = (await request.json()) as { diagnosisId?: number; recheckTaskId?: number | null; requestedWeeks?: number; note?: string | null };

  if (!body.diagnosisId) {
    return NextResponse.json({ ok: false, message: "这次还没指到哪条结果，我先没法记开通意向。" }, { status: 400 });
  }

  const id = createTrackingIntent({
    studentId,
    diagnosisId: body.diagnosisId,
    recheckTaskId: body.recheckTaskId ?? null,
    requestedWeeks: body.requestedWeeks ?? 4,
    note: body.note ?? null
  });

  appendResultPageEvent({
    studentId,
    diagnosisId: body.diagnosisId,
    eventName: "submit_tracking_intent",
    eventValue: `weeks:${body.requestedWeeks ?? 4}`
  });

  return NextResponse.json({ ok: true, id });
}
