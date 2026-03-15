import { NextResponse } from "next/server";
import { createSkillAssetAdmin } from "@/lib/db/admin";
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

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Omit<SkillAsset, "id">>;
  createSkillAssetAdmin(toPayload(body));
  return NextResponse.json({ ok: true });
}
