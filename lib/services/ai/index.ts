import { ENGLISH_BACKEND_TAGS, MOCK_DIAGNOSIS_TEMPLATES } from "@/lib/mock-data";
import { getStudentDiagnoses } from "@/lib/db";
import { rewriteDiagnosisForChenTeacher, rewriteWeeklyReportForChenTeacher } from "@/lib/services/tone-chen";
import type { DiagnosisPayload, Subject, WeeklyReportPayload } from "@/lib/types";

export interface AnalyzeUploadInput {
  subject: Subject;
  module: string;
  scoreNote?: string | null;
  note?: string | null;
  studentSelfReport?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  imageBase64?: string | null;
}

interface CompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function parseScore(scoreNote?: string | null) {
  if (!scoreNote) {
    return null;
  }
  const match = scoreNote.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function uniqueStrings(items: string[], limit: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function isMostlyAscii(value: string) {
  if (!value.trim()) {
    return false;
  }
  const plain = value.replace(/\s+/g, "");
  const asciiChars = plain.match(/[\x00-\x7F]/g)?.length ?? 0;
  return asciiChars / plain.length > 0.7;
}

function shouldFallbackToTemplate(items: string[]) {
  if (items.length === 0) {
    return true;
  }
  const asciiHeavyCount = items.filter((item) => isMostlyAscii(item)).length;
  return asciiHeavyCount / items.length > 0.5;
}

function applyHeuristics(template: DiagnosisPayload, input: AnalyzeUploadInput): DiagnosisPayload {
  const score = parseScore(input.scoreNote);
  const lowScore = score !== null && score < 75;
  const selfReport = input.studentSelfReport?.trim();

  const problemTags = [...template.problem_tags];
  const repairActions = [...template.repair_actions];

  if (selfReport) {
    problemTags.unshift(`学生自述：${selfReport}`);
  }

  if (lowScore) {
    repairActions.unshift("本周先做基础题限时回放，避免继续叠加新难题");
  }

  if (input.subject === "english" && !problemTags.some((item) => ENGLISH_BACKEND_TAGS.includes(item))) {
    problemTags.push(ENGLISH_BACKEND_TAGS[0]);
  }

  return {
    ...template,
    module: input.module,
    current_stage: `${template.current_stage}${lowScore ? "，当前先回到基础巩固节奏" : ""}`,
    problem_tags: problemTags.slice(0, 6),
    repair_actions: repairActions.slice(0, 6),
    parent_summary: selfReport
      ? `${template.parent_summary} 学生本次自述为“${selfReport}”，建议优先围绕这类场景做订正。`
      : template.parent_summary
  };
}

function getTemplate(input: AnalyzeUploadInput) {
  const templates = MOCK_DIAGNOSIS_TEMPLATES[input.subject];
  return templates.find((template) => template.module === input.module) ?? templates[0];
}

async function runMockDiagnosis(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  const matchedTemplate = getTemplate(input);
  return rewriteDiagnosisForChenTeacher(applyHeuristics(matchedTemplate, input));
}

function getRealProviderEnabled() {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  return provider === "real" || provider === "qwen" || provider === "openai-compatible";
}

function getModelChain() {
  return uniqueStrings(
    [
      process.env.AI_MODEL_PRIMARY ?? "qwen3.5-plus",
      process.env.AI_MODEL_CHEAP ?? "qwen3.5-flash",
      process.env.AI_MODEL_FALLBACK ?? "gemini-2.5-flash"
    ],
    3
  );
}

function extractTextContent(response: CompatibleChatResponse) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

function extractJsonString(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (char === '"' && !escaped) {
        inString = false;
      }
      escaped = char === "\\" && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      escaped = false;
      continue;
    }
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1);
      }
    }
  }

  throw new Error("Incomplete JSON object in model response.");
}

function sanitizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return uniqueStrings(
    value.filter((item): item is string => typeof item === "string").map((item) => item.trim()),
    6
  );
}

function normalizeConfidence(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  if (value > 1) {
    return Math.min(1, Number((value / 100).toFixed(2)));
  }
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function normalizeDiagnosisPayload(raw: unknown, input: AnalyzeUploadInput): DiagnosisPayload {
  const template = applyHeuristics(getTemplate(input), input);

  if (!raw || typeof raw !== "object") {
    return rewriteDiagnosisForChenTeacher(template);
  }

  const payload = raw as Record<string, unknown>;
  const rawProblemTags = sanitizeStringArray(payload.problem_tags, template.problem_tags);
  const rawRepairActions = sanitizeStringArray(payload.repair_actions, template.repair_actions);
  const normalized: DiagnosisPayload = {
    current_stage:
      typeof payload.current_stage === "string" && payload.current_stage.trim() && !isMostlyAscii(payload.current_stage)
        ? payload.current_stage.trim()
        : template.current_stage,
    subject: input.subject,
    module: input.module,
    problem_tags: shouldFallbackToTemplate(rawProblemTags) ? template.problem_tags : rawProblemTags,
    repair_actions: shouldFallbackToTemplate(rawRepairActions) ? template.repair_actions : rawRepairActions,
    parent_summary:
      typeof payload.parent_summary === "string" && payload.parent_summary.trim() && !isMostlyAscii(payload.parent_summary)
        ? payload.parent_summary.trim()
        : template.parent_summary,
    confidence: normalizeConfidence(payload.confidence, template.confidence),
    review_status: "pending"
  };

  if (input.subject === "english" && !normalized.problem_tags.some((item) => ENGLISH_BACKEND_TAGS.includes(item))) {
    normalized.problem_tags = uniqueStrings([...normalized.problem_tags, ENGLISH_BACKEND_TAGS[0]], 6);
  }

  return rewriteDiagnosisForChenTeacher(applyHeuristics(normalized, input));
}

function normalizeWeeklyReportPayload(raw: unknown, fallback: WeeklyReportPayload): WeeklyReportPayload {
  if (!raw || typeof raw !== "object") {
    return rewriteWeeklyReportForChenTeacher(fallback);
  }

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
}) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  if (!apiKey || !baseUrl) {
    throw new Error("Missing AI credentials.");
  }

  const userContent = options.imageBase64
    ? [
        { type: "text", text: options.prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${options.fileMimeType ?? "image/png"};base64,${options.imageBase64}`
          }
        }
      ]
    : options.prompt;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "你是学生问题诊断系统的分析引擎。你只返回严格 JSON。所有字段内容必须用简体中文，module 必须原样沿用用户给定值，不要改成英文。"
        },
        {
          role: "user",
          content: userContent
        }
      ]
    }),
    signal: AbortSignal.timeout(150000)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Provider request failed (${response.status}): ${text}`);
  }

  const parsed = JSON.parse(text) as CompatibleChatResponse;
  return extractTextContent(parsed);
}

function buildDiagnosisPrompt(input: AnalyzeUploadInput) {
  return [
    "请根据学生上传的题图/作业图/试卷图做学习问题诊断。",
    "输出必须是 JSON，对齐以下字段：current_stage, subject, module, problem_tags, repair_actions, parent_summary, confidence, review_status。",
    "全部字段内容请使用简体中文。module 必须原样返回这个值，不要翻译不要改写：" + input.module,
    "problem_tags 和 repair_actions 必须是字符串数组；review_status 固定返回 pending；confidence 返回 0 到 1 之间的小数。",
    `subject: ${input.subject}`,
    `module: ${input.module}`,
    `score_note: ${input.scoreNote ?? ""}`,
    `note: ${input.note ?? ""}`,
    `student_self_report: ${input.studentSelfReport ?? ""}`,
    `file_name: ${input.fileName ?? ""}`,
    "请重点识别：孩子当前卡点、重复错因、这周最值得执行的 2 到 3 个修复动作。"
  ].join("\n");
}

function buildWeeklyPrompt(base: WeeklyReportPayload) {
  return [
    "请把下面这份学习周报事实整理成更适合家长阅读的 JSON。",
    "输出字段必须保持：this_week_problem, this_week_actions, improved_points, unstable_points, repeated_error_tags, next_week_plan。",
    "每个字段都返回字符串数组，全部用简体中文，不要增加别的字段。",
    JSON.stringify(base, null, 2)
  ].join("\n");
}

async function runRealDiagnosis(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  const prompt = buildDiagnosisPrompt(input);
  let lastError: unknown = null;

  for (const model of getModelChain()) {
    try {
      const raw = await callCompatibleChat({
        model,
        prompt,
        imageBase64: input.imageBase64,
        fileMimeType: input.fileMimeType
      });
      return normalizeDiagnosisPayload(JSON.parse(extractJsonString(raw)), input);
    } catch (error) {
      lastError = error;
      if (input.imageBase64) {
        try {
          const raw = await callCompatibleChat({ model, prompt });
          return normalizeDiagnosisPayload(JSON.parse(extractJsonString(raw)), input);
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  console.error("Real diagnosis failed, fallback to mock diagnosis.", lastError);
  return runMockDiagnosis(input);
}

export async function analyzeUpload(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  if (getRealProviderEnabled()) {
    return runRealDiagnosis(input);
  }
  return runMockDiagnosis(input);
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
    improved_points:
      approved.length > 0
        ? approved.slice(0, 3).map((item) => `${item.subject === "math" ? "数学" : "英语"}${item.module}进入已审核归档`)
        : ["本周仍以发现问题为主，改善项等待审核确认"],
    unstable_points: uniqueStrings(unstable.slice(0, 3).map((item) => item.current_stage), 3),
    repeated_error_tags: uniqueStrings(problemPool, 4),
    next_week_plan: [
      "优先盯住重复出现的错因标签",
      "每个科目只保留 1 到 2 个重点动作",
      "周末前完成一次修复动作复盘"
    ]
  };
}

async function polishWeeklyReportWithModel(base: WeeklyReportPayload): Promise<WeeklyReportPayload> {
  let lastError: unknown = null;
  const prompt = buildWeeklyPrompt(base);

  for (const model of getModelChain()) {
    try {
      const raw = await callCompatibleChat({ model, prompt });
      return normalizeWeeklyReportPayload(JSON.parse(extractJsonString(raw)), base);
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Weekly report polish failed, fallback to local aggregation.", lastError);
  return rewriteWeeklyReportForChenTeacher(base);
}

export async function generateWeeklyReport(studentId: number): Promise<WeeklyReportPayload> {
  const base = buildBaseWeeklyReport(studentId);

  if (getRealProviderEnabled()) {
    return polishWeeklyReportWithModel(base);
  }

  return rewriteWeeklyReportForChenTeacher(base);
}

