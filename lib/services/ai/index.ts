import { ENGLISH_BACKEND_TAGS, MOCK_DIAGNOSIS_TEMPLATES } from "@/lib/mock-data";
import { getStudentDiagnoses } from "@/lib/db";
import type { DiagnosisPayload, Subject, WeeklyReportPayload } from "@/lib/types";

export interface AnalyzeUploadInput {
  subject: Subject;
  module: string;
  scoreNote?: string | null;
  note?: string | null;
  studentSelfReport?: string | null;
}

function parseScore(scoreNote?: string | null) {
  if (!scoreNote) {
    return null;
  }
  const match = scoreNote.match(/\d+/);
  return match ? Number(match[0]) : null;
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

async function runMockDiagnosis(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  const templates = MOCK_DIAGNOSIS_TEMPLATES[input.subject];
  const matchedTemplate =
    templates.find((template) => template.module === input.module) ?? templates[0];
  return applyHeuristics(matchedTemplate, input);
}

async function runRealDiagnosis(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;

  if (!apiKey || !baseUrl) {
    return runMockDiagnosis(input);
  }

  // Real model integration point: replace this stub with an actual provider call.
  return runMockDiagnosis(input);
}

export async function analyzeUpload(input: AnalyzeUploadInput): Promise<DiagnosisPayload> {
  const provider = process.env.AI_PROVIDER ?? "mock";
  if (provider === "real") {
    return runRealDiagnosis(input);
  }
  return runMockDiagnosis(input);
}

export async function generateWeeklyReport(studentId: number): Promise<WeeklyReportPayload> {
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
    this_week_problem: Array.from(new Set(problemPool)).slice(0, 5),
    this_week_actions: Array.from(new Set(actionPool)).slice(0, 5),
    improved_points:
      approved.length > 0
        ? approved.slice(0, 3).map((item) => `${item.subject === "math" ? "数学" : "英语"}${item.module}进入已审核归档`)
        : ["本周仍以发现问题为主，改善项等待审核确认"],
    unstable_points: unstable.slice(0, 3).map((item) => item.current_stage),
    repeated_error_tags: Array.from(new Set(problemPool)).slice(0, 4),
    next_week_plan: [
      "优先盯住重复出现的错因标签",
      "每个科目只保留 1 到 2 个重点动作",
      "周末前完成一次修复动作复盘"
    ]
  };
}
