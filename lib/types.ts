export type Subject = "math" | "english";

export type ReviewStatus = "pending" | "approved" | "rejected" | "edited";
export type DiagnosisMode = "quick" | "standard" | "deep";
export type StepQuality = "none" | "partial" | "clear";
export type StuckPointSource = "parent_selected" | "student_selected" | "ai_inferred" | "reviewer_corrected";
export type ResultEventName =
  | "opened_result"
  | "viewed_result_complete"
  | "click_continue_tracking"
  | "click_asset"
  | "click_only_take_advice"
  | "paid_conversion";

export interface DiagnosisPayload {
  current_stage: string;
  subject: Subject;
  module: string;
  problem_tags: string[];
  repair_actions: string[];
  parent_summary: string;
  confidence: number;
  review_status: ReviewStatus;
}

export interface WeeklyReportPayload {
  this_week_problem: string[];
  this_week_actions: string[];
  improved_points: string[];
  unstable_points: string[];
  repeated_error_tags: string[];
  next_week_plan: string[];
}

export interface MemorySummary {
  stable_tags: string[];
  repeated_error_tags: string[];
  last_3_weeks_focus: string[];
  last_best_improvement: string;
  next_priority: string;
  preferred_tone: string;
  updated_at: string;
}

export interface TrialAccessSnapshot {
  userId: number;
  studentId: number;
  phone: string | null;
  inviteCode: string | null;
  freeTrialTotal: number;
  freeTrialUsed: number;
  freeTrialRemaining: number;
  maxImagesPerUpload: number;
  enabledGrades: string[];
  enabledSubjects: Subject[];
  gradeOpen: boolean;
  subjectOpenMap: Record<Subject, boolean>;
}

export interface SkillAsset {
  id: number;
  subject: Subject;
  module: string;
  tag: string;
  difficulty: string;
  assetType: string;
  title: string;
  summary: string;
  fileUrl: string;
  previewUrl: string;
  useStage: string;
  paidOnly: boolean;
}

export interface DashboardSnapshot {
  studentName: string;
  currentStage: string;
  weeklyUploadCount: number;
  weeklyProblems: string[];
  weeklyActions: string[];
  weeklyChanges: string[];
  nextWeekFocus: string[];
  latestDiagnosisId: number | null;
  latestWeeklyReportId: number | null;
}

export interface SubjectSnapshot {
  subject: Subject;
  currentStage: string;
  weeklyProblems: string[];
  weeklyActions: string[];
  repeatedTags: string[];
  recentChanges: string[];
  modules: string[];
}

export interface DiagnosisDetail {
  id: number;
  studentId?: number;
  studentName: string;
  uploadId: number;
  subject: Subject;
  module: string;
  diagnosisMode?: DiagnosisMode;
  currentStage: string;
  problemTags: string[];
  repairActions: string[];
  parentSummary: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  rawJson: DiagnosisPayload;
  draftDiagnosis?: DiagnosisPayload;
  approvedDiagnosis?: DiagnosisPayload | null;
  reviewNotes?: string | null;
  reviewDiff?: Record<string, unknown> | null;
  createdAt: string;
  scoreNote: string | null;
  studentSelfReport: string | null;
  stuckPointChoice?: string | null;
  stuckPointSource?: StuckPointSource;
  stepsText?: string | null;
  hasSteps?: boolean;
  stepQuality?: StepQuality;
  fileName: string;
}

export interface WeeklyReportDetail {
  id: number;
  studentName: string;
  weekLabel: string;
  payload: WeeklyReportPayload;
  createdAt: string;
}

export interface ReviewQueueItem {
  id: number;
  studentName: string;
  subject: Subject;
  module: string;
  reviewStatus: ReviewStatus;
  confidence: number;
  createdAt: string;
  payload: DiagnosisPayload;
  reviewNotes?: string | null;
}

export interface ModelCallLogDetail {
  id: number;
  studentId: number;
  uploadId: number | null;
  provider: string;
  modelName: string;
  diagnosisMode: DiagnosisMode;
  promptVersion: string;
  inputSize: number;
  outputSize: number;
  estimatedCost: number;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  retryCount: number;
  createdAt: string;
}
