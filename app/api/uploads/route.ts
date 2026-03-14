import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  appendChangeLog,
  createDiagnosisRecord,
  createRepairTasks,
  createUploadRecord,
  getPrimaryStudentId,
  upsertWeeklyReport
} from "@/lib/db";
import { upsertMemorySummary } from "@/lib/db/memory";
import { analyzeUpload, generateWeeklyReport } from "@/lib/services/ai";
import type { Subject } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const subject = formData.get("subject");
  const module = formData.get("module");
  const uploadType = formData.get("uploadType");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "请上传图片文件。" }, { status: 400 });
  }

  if (subject !== "math" && subject !== "english") {
    return NextResponse.json({ ok: false, message: "科目不合法。" }, { status: 400 });
  }

  if (typeof module !== "string" || !module) {
    return NextResponse.json({ ok: false, message: "请选择模块。" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const extension = path.extname(file.name) || ".png";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fullPath = path.join(uploadsDir, safeName);
  await fs.writeFile(fullPath, buffer);

  const scoreNote = String(formData.get("scoreNote") || "") || null;
  const note = String(formData.get("note") || "") || null;
  const studentSelfReport = String(formData.get("studentSelfReport") || "") || null;
  const studentId = getPrimaryStudentId();
  const uploadId = createUploadRecord({
    studentId,
    subject: subject as Subject,
    module,
    scoreNote,
    note,
    studentSelfReport,
    uploadType: typeof uploadType === "string" && uploadType ? uploadType : "题图",
    fileName: file.name,
    filePath: `uploads/${safeName}`
  });

  const diagnosis = await analyzeUpload({
    subject: subject as Subject,
    module,
    scoreNote,
    note,
    studentSelfReport,
    fileName: file.name,
    fileMimeType: file.type || `image/${extension.replace(/^\./, "")}`,
    imageBase64: buffer.toString("base64")
  });

  const diagnosisId = createDiagnosisRecord(uploadId, diagnosis);
  createRepairTasks(diagnosisId, studentId, diagnosis.subject, diagnosis.module, diagnosis.repair_actions);
  appendChangeLog(
    studentId,
    diagnosis.subject,
    diagnosis.module,
    "detected",
    `新问题进入队列：${diagnosis.problem_tags[0] ?? diagnosis.module}`,
    diagnosisId
  );

  const weeklyReport = await generateWeeklyReport(studentId);
  const weeklyReportId = upsertWeeklyReport(studentId, weeklyReport);
  upsertMemorySummary(studentId);

  return NextResponse.json({ ok: true, diagnosisId, weeklyReportId });
}
