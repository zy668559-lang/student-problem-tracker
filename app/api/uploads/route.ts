import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  createDiagnosisRecord,
  createRepairTasks,
  createUploadRecord,
  getPrimaryStudentId,
  upsertWeeklyReport
} from "@/lib/db";
import {
  appendStructuredChangeLog,
  ensureProductSchema,
  enrichDiagnosisRecord,
  recordUploadMeta,
  upsertStudentMemorySummary,
  validateUploadAccess
} from "@/lib/db/product";
import { analyzeUpload, generateWeeklyReport } from "@/lib/services/ai";
import { softenUploadError } from "@/lib/services/tone-chen";
import type { DiagnosisMode, StepQuality, StuckPointSource, Subject, TrialAccessSnapshot } from "@/lib/types";

export const runtime = "nodejs";

function inferStepQuality(stepsText: string) {
  const length = stepsText.trim().length;
  if (length === 0) return "none" as StepQuality;
  if (length < 30) return "partial" as StepQuality;
  return "clear" as StepQuality;
}

function inferDiagnosisMode(hasSteps: boolean, stuckPointChoice: string, hasHistory: boolean) {
  if (!hasSteps && !stuckPointChoice) return "quick" as DiagnosisMode;
  if (hasSteps && hasHistory) return "deep" as DiagnosisMode;
  return "standard" as DiagnosisMode;
}

export async function POST(request: Request) {
  ensureProductSchema();
  const formData = await request.formData();
  const file = formData.get("file");
  const subject = formData.get("subject");
  const module = formData.get("module");
  const uploadType = formData.get("uploadType");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: softenUploadError("图片为空") }, { status: 400 });
  }

  if (subject !== "math" && subject !== "english") {
    return NextResponse.json({ ok: false, message: "科目这次没对上，我先不给它往下跑。" }, { status: 400 });
  }

  if (typeof module !== "string" || !module) {
    return NextResponse.json({ ok: false, message: "模块先选一下，我才能更准地帮你判断。" }, { status: 400 });
  }

  const studentId = getPrimaryStudentId();
  const guard = validateUploadAccess(studentId, subject as Subject, 1) as { ok: true; access: TrialAccessSnapshot } | { ok: false; message: string };
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: 403 });
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
  const stuckPointChoice = String(formData.get("stuckPointChoice") || "").trim();
  const stepsText = String(formData.get("stepsText") || "").trim();
  const hasSteps = stepsText.length > 0;
  const stepQuality = inferStepQuality(stepsText);
  const hasHistory = guard.access.freeTrialUsed > 0;
  const diagnosisMode = inferDiagnosisMode(hasSteps, stuckPointChoice, hasHistory);

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

  recordUploadMeta(uploadId, {
    stuckPointChoice: stuckPointChoice || null,
    stuckPointSource: stuckPointChoice ? ("student_selected" as StuckPointSource) : ("ai_inferred" as StuckPointSource),
    stepsText: stepsText || null,
    hasSteps,
    stepQuality,
    imageCount: 1,
    diagnosisMode
  });

  const diagnosis = await analyzeUpload({
    studentId,
    uploadId,
    subject: subject as Subject,
    module,
    scoreNote,
    note,
    studentSelfReport,
    fileName: file.name,
    fileMimeType: file.type || `image/${extension.replace(/^\./, "")}`,
    imageBase64: buffer.toString("base64"),
    stuckPointChoice: stuckPointChoice || null,
    stuckPointSource: stuckPointChoice ? "student_selected" : "ai_inferred",
    stepsText: stepsText || null,
    hasSteps,
    stepQuality,
    diagnosisMode
  });

  const diagnosisId = createDiagnosisRecord(uploadId, diagnosis);
  enrichDiagnosisRecord(diagnosisId, {
    draftDiagnosis: diagnosis,
    diagnosisMode,
    promptVersion: "diag-v5"
  });
  createRepairTasks(diagnosisId, studentId, diagnosis.subject, diagnosis.module, diagnosis.repair_actions);
  appendStructuredChangeLog({
    studentId,
    subject: diagnosis.subject,
    module: diagnosis.module,
    changeType: "detected",
    description: `这次新看出来的主卡点是：${diagnosis.problem_tags[0] ?? diagnosis.module}`,
    relatedDiagnosisId: diagnosisId,
    newIssues: diagnosis.problem_tags,
    unstableIssues: [diagnosis.current_stage],
    repeatedErrorTags: diagnosis.problem_tags.slice(0, 3),
    evidenceSummary: stuckPointChoice ? `孩子这次自己选了卡点：${stuckPointChoice}` : "这次没选卡点自评，先按图和文字自动判断。"
  });

  const weeklyReport = await generateWeeklyReport(studentId);
  const weeklyReportId = upsertWeeklyReport(studentId, weeklyReport);
  upsertStudentMemorySummary(studentId);

  return NextResponse.json({ ok: true, diagnosisId, weeklyReportId });
}
