export type Subject = "math" | "english";

export type ReviewStatus = "pending" | "approved" | "rejected" | "edited";

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
  next_priority: string;
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
  studentName: string;
  uploadId: number;
  subject: Subject;
  module: string;
  currentStage: string;
  problemTags: string[];
  repairActions: string[];
  parentSummary: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  rawJson: DiagnosisPayload;
  createdAt: string;
  scoreNote: string | null;
  studentSelfReport: string | null;
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
}
