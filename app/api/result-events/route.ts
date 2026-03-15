import { NextResponse } from "next/server";
import { getPrimaryStudentId } from "@/lib/db";
import { appendResultPageEvent, ensureProductSchema } from "@/lib/db/product";
import type { ResultEventName } from "@/lib/types";

export async function POST(request: Request) {
  ensureProductSchema();
  const body = (await request.json()) as { diagnosisId?: number; eventName?: ResultEventName; assetId?: number | null; eventValue?: string | null };

  if (!body.diagnosisId || !body.eventName) {
    return NextResponse.json({ ok: false, message: "事件信息还没给全。" }, { status: 400 });
  }

  appendResultPageEvent({
    studentId: getPrimaryStudentId(),
    diagnosisId: body.diagnosisId,
    eventName: body.eventName,
    assetId: body.assetId ?? null,
    eventValue: body.eventValue ?? null
  });

  return NextResponse.json({ ok: true });
}
