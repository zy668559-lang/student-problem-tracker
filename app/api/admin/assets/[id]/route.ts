import { NextResponse } from "next/server";
import { deleteSkillAssetAdmin, updateSkillAssetAdmin } from "@/lib/db/admin";
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<Omit<SkillAsset, "id">>;
  updateSkillAssetAdmin(Number(id), toPayload(body));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteSkillAssetAdmin(Number(id));
  return NextResponse.json({ ok: true });
}
