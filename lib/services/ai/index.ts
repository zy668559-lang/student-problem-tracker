import { ENGLISH_BACKEND_TAGS, MOCK_DIAGNOSIS_TEMPLATES } from "@/lib/mock-data";
import { getStudentDiagnoses } from "@/lib/db";
import { getWeeklyReportRecheckOverlay } from "@/lib/db/recheck";
import { createModelCallLog, getStudentMemorySummary } from "@/lib/db/product";
import { rewriteDiagnosisForChenTeacher, rewriteWeeklyReportForChenTeacher } from "@/lib/services/tone-chen";
import type { DiagnosisMode, DiagnosisPayload, StepQuality, StuckPointSource, Subject, WeeklyReportPayload } from "@/lib/types";

export interface AnalyzeUploadInput {
  studentId: number;
  uploadId: number;
  subject: Subject;
  module: string;
  scoreNote?: string | null;
  note?: string | null;
  studentSelfReport?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  imageBase64?: string | null;
  stuckPointChoice?: string | null;
  stuckPointSource: StuckPointSource;
  stepsText?: string | null;
  hasSteps: boolean;
  stepQuality: StepQuality;
  diagnosisMode: DiagnosisMode;
}

interface CompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const DIAGNOSIS_PROMPT_VERSION = "diag-v5";
const WEEKLY_PROMPT_VERSION = "weekly-v3";

function parseScore(scoreNote?: string | null) {
  if (!scoreNote) return null;
  const match = scoreNote.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function uniqueStrings(items: string[], limit: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function isMostlyAscii(value: string) {
  const plain = value.replace(/\s+/g, "").trim();
  if (!plain) return false;
  const asciiChars = plain.match(/[\x00-\x7F]/g)?.length ?? 0;
  return asciiChars / plain.length > 0.7;
}

function shouldFallbackToTemplate(items: string[]) {
  if (items.length === 0) return true;
  return items.filter((item) => isMostlyAscii(item)).length / items.length > 0.5;
}

function estimateCost(inputSize: number, outputSize: number, mode: DiagnosisMode) {
  const multiplier = mode === "deep" ? 1.35 : mode === "standard" ? 1 : 0.65;
  return Number((((inputSize + outputSize) / 1000) * 0.004 * multiplier).toFixed(4));
}

function getTemplate(input: AnalyzeUploadInput) {
  const templates = MOCK_DIAGNOSIS_TEMPLATES[input.subject];
  return templates.find((template) => template.module === input.module) ?? templates[0];
}

function applyHeuristics(template: DiagnosisPayload, input: AnalyzeUploadInput): DiagnosisPayload {
  const score = parseScore(input.scoreNote);
  const selfReport = input.studentSelfReport?.trim();
  const stuckPoint = input.stuckPointChoice?.trim();
  const problemTags = [...template.problem_tags];
  const repairActions = [...template.repair_actions];

  if (selfReport) {
    problemTags.unshift(`学生自述：${selfReport}`);
  }
  if (stuckPoint && !problemTags.includes(stuckPoint)) {
    problemTags.unshift(stuckPoint);
  }
  if (score !== null && score < 75) {
    repairActions.unshift("先把基础题的起手和收尾稳住，别急着继续叠新难题");
  }
  if (input.subject === "english" && !problemTags.some((item) => ENGLISH_BACKEND_TAGS.includes(item))) {
    problemTags.push(ENGLISH_BACKEND_TAGS[0]);
  }

  return {
    ...template,
    module: input.module,
    current_stage: `${template.current_stage}${input.diagnosisMode === "deep" ? "，这次会连历史记忆一起看" : ""}`,
    problem_tags: uniqueStrings(problemTags, 6),
    repair_actions: uniqueStrings(repairActions, 6),
    parent_summary: selfReport
      ? `${template.parent_summary} 这次孩子自己也提到了“${selfReport}”，所以我会优先围着这个点下手。`
      : template.parent_summary
  };
}

async function runMockDiagnosis(input: AnalyzeUploadInput) {
  return rewriteDiagnosisForChenTeacher(applyHeuristics(getTemplate(input), input));
}

function getRealProviderEnabled() {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  return provider === "real" || provider === "qwen" || provider === "openai-compatible";
}

function getModelChain(mode: DiagnosisMode) {
  const primary = process.env.AI_MODEL_PRIMARY ?? "qwen3.5-plus";
  const cheap = process.env.AI_MODEL_CHEAP ?? "qwen3.5-flash";
  const fallback = process.env.AI_MODEL_FALLBACK ?? "gemini-2.5-flash";
  const ordered = mode === "deep" ? [primary, cheap, fallback] : [cheap, primary, fallback];
  return uniqueStrings(ordered, 3);
}

function extractTextContent(response: CompatibleChatResponse) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => (typeof item?.text === "string" ? item.text : "")).join("\n").trim();
  }
  return "";
}

function extractJsonString(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model response.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (char === '"' && !escaped) inString = false;
      escaped = char === "\\" && !escaped;
      continue;
    }
    if (char === '"') {
      inString = true;
      escaped = false;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  throw new Error("Incomplete JSON object in model response.");
}

function sanitizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return uniqueStrings(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()), 6);
}

function normalizeDiagnosisPayload(raw: unknown, input: AnalyzeUploadInput) {
  const template = applyHeuristics(getTemplate(input), input);
  if (!raw || typeof raw !== "object") return rewriteDiagnosisForChenTeacher(template);
  const payload = raw as Record<string, unknown>;
  const problemTags = sanitizeStringArray(payload.problem_tags, template.problem_tags);
  const repairActions = sanitizeStringArray(payload.repair_actions, template.repair_actions);
  const normalized: DiagnosisPayload = {
    current_stage: typeof payload.current_stage === "string" && payload.current_stage.trim() && !isMostlyAscii(payload.current_stage)
      ? payload.current_stage.trim()
      : template.current_stage,
    subject: input.subject,
    module: input.module,
    problem_tags: shouldFallbackToTemplate(problemTags) ? template.problem_tags : problemTags,
    repair_actions: shouldFallbackToTemplate(repairActions) ? template.repair_actions : repairActions,
    parent_summary: typeof payload.parent_summary === "string" && payload.parent_summary.trim() && !isMostlyAscii(payload.parent_summary)
      ? payload.parent_summary.trim()
      : template.parent_summary,
    confidence: typeof payload.confidence === "number" ? Math.min(1, Math.max(0, payload.confidence)) : template.confidence,
    review_status: "pending"
  };
  if (input.subject === "english" && !normalized.problem_tags.some((item) => ENGLISH_BACKEND_TAGS.includes(item))) {
    normalized.problem_tags = uniqueStrings([...normalized.problem_tags, ENGLISH_BACKEND_TAGS[0]], 6);
  }
  return rewriteDiagnosisForChenTeacher(applyHeuristics(normalized, input));
}

function normalizeWeeklyReportPayload(raw: unknown, fallback: WeeklyReportPayload) {
  if (!raw || typeof raw !== "object") return rewriteWeeklyReportForChenTeacher(fallback);
  const payload = raw as Record<string, unknown>;
  return rewriteWeeklyReportForChenTeacher({
    this_week_problem: sanitizeStringArray(payload.this_week_problem, fallback.this_week_problem).slice(0, 5),
    this_week_actions: sanitizeStringArray(payload.this_week_actions, fallback.this_week_actions).slice(0, 5),
    improved_points: sanitizeStringArray(payload.improved_points, fallback.improved_points).slice(0, 5),
    unstable_points: sanitizeStringArray(payload.unstable_points, fallback.unstable_points).slice(0, 5),
    repeated_error_tags: sanitizeStringArray(payload.repeated_error_tags, fallback.repeated_error_tags).slice(0, 4),
    next_week_plan: sanitizeStringArray(payload.next_week_plan, fallback.next_week_plan).slice(0, 5)
  });
}

async function callCompatibleChat(options: {
  model: string;
  prompt: string;
  imageBase64?: string | null;
  fileMimeType?: string | null;
  studentId: number;
  uploadId: number | null;
  diagnosisMode: DiagnosisMode;
  promptVersion: string;
  retryCount: number;
}) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const provider = process.env.AI_PROVIDER ?? "mock";
  if (!apiKey || !baseUrl) {
    createModelCallLog({ studentId: options.studentId, uploadId: options.uploadId, provider, modelName: options.model, diagnosisMode: options.diagnosisMode, promptVersion: options.promptVersion, inputSize: options.prompt.length, outputSize: 0, estimatedCost: 0, latencyMs: 0, success: false, errorCode: "missing_credentials", retryCount: options.retryCount });
    throw new Error("Missing AI credentials.");
  }

  const startedAt = Date.now();
  const userContent = options.imageBase64
    ? [{ type: "text", text: options.prompt }, { type: "image_url", image_url: { url: `data:${options.fileMimeType ?? "image/png"};base64,${options.imageBase64}` } }]
    : options.prompt;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          { role: "system", content: "你是学生问题诊断系统的分析引擎。你只返回严格 JSON。所有字段内容必须用简体中文，module 必须原样沿用用户给定值。" },
          { role: "user", content: userContent }
        ]
      }),
      signal: AbortSignal.timeout(options.diagnosisMode === "deep" ? 180000 : 150000)
    });
    const text = await response.text();
    const latencyMs = Date.now() - startedAt;
    createModelCallLog({ studentId: options.studentId, uploadId: options.uploadId, provider, modelName: options.model, diagnosisMode: options.diagnosisMode, promptVersion: options.promptVersion, inputSize: options.prompt.length, outputSize: text.length, estimatedCost: estimateCost(options.prompt.length, text.length, options.diagnosisMode), latencyMs, success: response.ok, errorCode: response.ok ? null : `http_${response.status}`, retryCount: options.retryCount });
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${text}`);
    return extractTextContent(JSON.parse(text) as CompatibleChatResponse);
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    createModelCallLog({ studentId: options.studentId, uploadId: options.uploadId, provider, modelName: options.model, diagnosisMode: options.diagnosisMode, promptVersion: options.promptVersion, inputSize: options.prompt.length, outputSize: 0, estimatedCost: 0, latencyMs, success: false, errorCode: error instanceof Error ? error.name : "provider_error", retryCount: options.retryCount });
    throw error;
  }
}

function buildDiagnosisPrompt(input: AnalyzeUploadInput) {
  const memory = input.diagnosisMode === "deep" ? getStudentMemorySummary(input.studentId) : null;
  return [
    "请根据学生上传的题图/作业图/试卷图做学习问题诊断。",
    "输出必须是 JSON，对齐以下字段：current_stage, subject, module, problem_tags, repair_actions, parent_summary, confidence, review_status。",
    `subject: ${input.subject}`,
    `module: ${input.module}`,
    `diagnosis_mode: ${input.diagnosisMode}`,
    `score_note: ${input.scoreNote ?? ""}`,
    `note: ${input.note ?? ""}`,
    `student_self_report: ${input.studentSelfReport ?? ""}`,
    `stuck_point_choice: ${input.stuckPointChoice ?? ""}`,
    `stuck_point_source: ${input.stuckPointSource}`,
    `steps_text: ${input.stepsText ?? ""}`,
    `step_quality: ${input.stepQuality}`,
    memory ? `memory_next_priority: ${memory.next_priority}` : "",
    memory ? `memory_repeated_error_tags: ${memory.repeated_error_tags.join(" | ")}` : "",
    "请用简体中文，问题标签和修复动作都要说人话，review_status 固定返回 pending。"
  ].filter(Boolean).join("\n");
}

function buildBaseWeeklyReport(studentId: number): WeeklyReportPayload {
  const diagnoses = getStudentDiagnoses(studentId);
  if (diagnoses.length === 0) {
    return {
      this_week_problem: ["等待首次上传后生成本周问题"],
      this_week_actions: ["先上传错题或试卷图片"],
      improved_points: ["暂无数据"],
      unstable_points: ["暂无数据"],
      repeated_error_tags: ["暂无数据"],
      next_week_plan: ["完成本周第一次上传"]
    };
  }
  const problemPool = diagnoses.flatMap((item) => JSON.parse(item.problem_tags) as string[]);
  const actionPool = diagnoses.flatMap((item) => JSON.parse(item.repair_actions) as string[]);
  const approved = diagnoses.filter((item) => item.review_status === "approved");
  const unstable = diagnoses.filter((item) => item.review_status !== "approved");
  return {
    this_week_problem: uniqueStrings(problemPool, 5),
    this_week_actions: uniqueStrings(actionPool, 5),
    improved_points: approved.length > 0 ? approved.slice(0, 3).map((item) => `${item.subject === "math" ? "数学" : "英语"}${item.module}这一块开始稳一点了`) : ["这周还在先找主要问题"],
    unstable_points: uniqueStrings(unstable.slice(0, 3).map((item) => item.current_stage), 3),
    repeated_error_tags: uniqueStrings(problemPool, 4),
    next_week_plan: ["优先盯住重复出现的错因", "每科只留 1 到 2 个重点动作", "周末前做一次复盘"]
  };
}

function enrichWeeklyReportWithRecheck(studentId: number, payload: WeeklyReportPayload) {
  const overlay = getWeeklyReportRecheckOverlay(studentId);
  return rewriteWeeklyReportForChenTeacher({
    ...payload,
    improved_points: uniqueStrings([...payload.improved_points, overlay.improvedPoint], 5),
    unstable_points: uniqueStrings([...payload.unstable_points, overlay.unstablePoint], 5),
    repeated_error_tags: uniqueStrings([...payload.repeated_error_tags, overlay.repeatedTag], 4),
    recheck_status: overlay.recheckStatus,
    next_priority: overlay.nextPriority,
    continue_tracking_reason: overlay.continueTrackingReason,
    student_today_action: overlay.studentTodayAction,
    student_minimum_action: overlay.studentMinimumAction,
    student_self_check: overlay.studentSelfCheck
  });
}

function buildWeeklyPrompt(base: WeeklyReportPayload) {
  return [
    "请把下面这份学习周报事实整理成更适合家长阅读的 JSON。",
    "输出字段必须保持：this_week_problem, this_week_actions, improved_points, unstable_points, repeated_error_tags, next_week_plan。",
    JSON.stringify(base, null, 2)
  ].join("\n");
}

async function runRealDiagnosis(input: AnalyzeUploadInput) {
  const prompt = buildDiagnosisPrompt(input);
  let retryCount = 0;
  let lastError: unknown = null;
  for (const model of getModelChain(input.diagnosisMode)) {
    try {
      const raw = await callCompatibleChat({ model, prompt, imageBase64: input.imageBase64, fileMimeType: input.fileMimeType, studentId: input.studentId, uploadId: input.uploadId, diagnosisMode: input.diagnosisMode, promptVersion: DIAGNOSIS_PROMPT_VERSION, retryCount });
      return normalizeDiagnosisPayload(JSON.parse(extractJsonString(raw)), input);
    } catch (error) {
      lastError = error;
      retryCount += 1;
      if (input.imageBase64) {
        try {
          const raw = await callCompatibleChat({ model, prompt, studentId: input.studentId, uploadId: input.uploadId, diagnosisMode: input.diagnosisMode, promptVersion: DIAGNOSIS_PROMPT_VERSION, retryCount });
          return normalizeDiagnosisPayload(JSON.parse(extractJsonString(raw)), input);
        } catch (retryError) {
          lastError = retryError;
          retryCount += 1;
        }
      }
    }
  }
  console.error("Real diagnosis failed, fallback to mock diagnosis.", lastError);
  return runMockDiagnosis(input);
}

export async function analyzeUpload(input: AnalyzeUploadInput) {
  if (getRealProviderEnabled()) return runRealDiagnosis(input);
  return runMockDiagnosis(input);
}

async function polishWeeklyReportWithModel(studentId: number, base: WeeklyReportPayload) {
  const prompt = buildWeeklyPrompt(base);
  let retryCount = 0;
  for (const model of getModelChain("standard")) {
    try {
      const raw = await callCompatibleChat({ model, prompt, studentId, uploadId: null, diagnosisMode: "standard", promptVersion: WEEKLY_PROMPT_VERSION, retryCount });
      return normalizeWeeklyReportPayload(JSON.parse(extractJsonString(raw)), base);
    } catch {
      retryCount += 1;
    }
  }
  return enrichWeeklyReportWithRecheck(studentId, base);
}

export async function generateWeeklyReport(studentId: number) {
  const base = buildBaseWeeklyReport(studentId);
  if (getRealProviderEnabled()) {
    const polished = await polishWeeklyReportWithModel(studentId, base);
    return enrichWeeklyReportWithRecheck(studentId, polished);
  }
  return enrichWeeklyReportWithRecheck(studentId, base);
}
