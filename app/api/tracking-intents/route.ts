import { NextResponse } from "next/server";
import { ensureA4Schema, syncLeadFollowupFromTrackingIntent } from "@/lib/db/a4";
import { ensureFollowupSchema, syncFollowupLeadFromTrackingIntent } from "@/lib/db/followups";
import { appendResultPageEvent, ensureProductSchema } from "@/lib/db/product";
import { createTrackingIntent, ensureP25Schema } from "@/lib/db/p25";
import { getActiveStudentId, parseSessionFromCookieHeader } from "@/lib/session";
import type { MembershipTier } from "@/lib/types";

export async function POST(request: Request) {
  ensureProductSchema();
  ensureP25Schema();
  ensureA4Schema();
  ensureFollowupSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  const studentId = getActiveStudentId(session);
  const body = (await request.json()) as {
    diagnosisId?: number;
    recheckTaskId?: number | null;
    requestedWeeks?: number;
    requestedTier?: MembershipTier;
    note?: string | null;
  };

  if (!body.diagnosisId) {
    return NextResponse.json({ ok: false, message: "这次还没指到哪条结果，我先没法记开通意向。" }, { status: 400 });
  }

  const id = createTrackingIntent({
    studentId,
    diagnosisId: body.diagnosisId,
    recheckTaskId: body.recheckTaskId ?? null,
    requestedWeeks: body.requestedWeeks ?? 4,
    requestedTier: body.requestedTier ?? "self_service",
    note: body.note ?? null
  });
  syncLeadFollowupFromTrackingIntent(id);
  syncFollowupLeadFromTrackingIntent(id);

  appendResultPageEvent({
    studentId,
    diagnosisId: body.diagnosisId,
    eventName: "submit_tracking_intent",
    eventValue: `weeks:${body.requestedWeeks ?? 4}`
  });

  return NextResponse.json({ ok: true, id });
}
