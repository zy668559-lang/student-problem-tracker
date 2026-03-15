import { NextResponse } from "next/server";
import { appendAdminActionLog, createSkillAssetAdmin, ensureAdminSchema, listSkillAssetsAdmin } from "@/lib/db/admin";
import { isAdminSession, parseSessionFromCookieHeader } from "@/lib/session";
import type { SkillAsset, Subject } from "@/lib/types";

function toPayload(body: Partial<Omit<SkillAsset, "id">>) {
  return {
    subject: (body.subject === "english" ? "english" : "math") as Subject,
    module: body.module ?? "函数",
    tag: body.tag ?? "untagged",
    difficulty: body.difficulty ?? "middle",
    assetType: body.assetType ?? "worksheet",
    title: body.title ?? "未命名素材",
    summary: body.summary ?? "",
    fileUrl: body.fileUrl ?? "/assets/demo.pdf",
    previewUrl: body.previewUrl ?? "/assets/demo.png",
    useStage: body.useStage ?? "diagnosis",
    paidOnly: Boolean(body.paidOnly)
  } satisfies Omit<SkillAsset, "id">;
}

export async function GET(request: Request) {
  ensureAdminSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能看素材库。" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, items: listSkillAssetsAdmin() });
}

export async function POST(request: Request) {
  ensureAdminSchema();
  const session = parseSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "只有管理员能改素材库。" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<Omit<SkillAsset, "id">>;
  const payload = toPayload(body);
  const assetId = createSkillAssetAdmin(payload);
  appendAdminActionLog({
    userId: session.userId,
    userRole: session.role,
    actionType: "create_skill_asset",
    targetType: "skill_asset",
    targetId: assetId,
    detail: `新增素材：${payload.title} / ${payload.tag}`
  });
  return NextResponse.json({ ok: true, id: assetId });
}
