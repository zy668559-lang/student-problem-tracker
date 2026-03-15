import { NextResponse } from "next/server";
import { appendResultPageEvent, ensureProductSchema } from "@/lib/db/product";
import { ensureFollowupSchema, syncFollowupLeadFromResultEvent } from "@/lib/db/followups";
import { getActiveStudentId, parseSessionFromCookieHeader } from "@/lib/session";
import type { ResultEventName } from "@/lib/types";

export async function POST(request: Request) {
  ensureProductSchema();
  ensureFollowupSchema();
  const body = (await request.json()) as { diagnosisId?: number; eventName?: ResultEventName; assetId?: number | null; eventValue?: string | null };

  if (!body.diagnosisId || !body.eventName) {
    return NextResponse.json({ ok: false, message: "result event payload missing" }, { status: 400 });
  }

  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));

  const studentId = getActiveStudentId(session);

  appendResultPageEvent({
    studentId,
    diagnosisId: body.diagnosisId,
    eventName: body.eventName,
    assetId: body.assetId ?? null,
    eventValue: body.eventValue ?? null
  });

  syncFollowupLeadFromResultEvent({
    studentId,
    diagnosisId: body.diagnosisId,
    eventName: body.eventName,
    eventValue: body.eventValue ?? null
  });

  return NextResponse.json({ ok: true });
}
