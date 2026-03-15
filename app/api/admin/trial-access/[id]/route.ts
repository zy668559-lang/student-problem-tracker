import { NextResponse } from "next/server";
import { updateTrialAccessAdmin } from "@/lib/db/admin";
import type { Subject } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    whitelistEnabled?: boolean;
    freeTrialTotal?: number;
    freeTrialUsed?: number;
    maxImagesPerUpload?: number;
    enabledGrades?: string[];
    enabledSubjects?: Subject[];
  };

  updateTrialAccessAdmin(Number(id), {
    whitelistEnabled: Boolean(body.whitelistEnabled),
    freeTrialTotal: Math.max(0, Number(body.freeTrialTotal ?? 0)),
    freeTrialUsed: Math.max(0, Number(body.freeTrialUsed ?? 0)),
    maxImagesPerUpload: Math.max(1, Number(body.maxImagesPerUpload ?? 1)),
    enabledGrades: Array.isArray(body.enabledGrades) ? body.enabledGrades : [],
    enabledSubjects: Array.isArray(body.enabledSubjects) ? body.enabledSubjects : []
  });

  return NextResponse.json({ ok: true });
}
