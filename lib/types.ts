export type Subject = "math" | "english";

export type ReviewStatus = "pending" | "approved" | "rejected" | "edited";
export type DiagnosisMode = "quick" | "standard" | "deep";
export type StepQuality = "none" | "partial" | "clear";
export type StuckPointSource = "parent_selected" | "student_selected" | "ai_inferred" | "reviewer_corrected";
export type RecheckTaskStatus = "queued" | "recheck_due" | "passed_once" | "improving" | "stabilized" | "dismissed";
export type RecheckOutcome = "baseline" | "blocked" | "improving" | "passed";
export type SubmissionType = "diagnosis" | "recheck";
export type TrackingStatus = "trial" | "intent" | "active";
export type TrackingIntentStatus = "intent_submitted" | "activated" | "closed";
export type RecheckManualDecision = "stabilized" | "unstable" | "bombing";
export type ResultEventName =
  | "opened_result"
  | "viewed_result_complete"
  | "opened_recheck_task"
  | "complete_recheck_upload"
  | "viewed_recheck_result_complete"
  | "click_continue_tracking"
  | "click_asset"
  | "click_only_take_advice"
  | "paid_conversion"
  | "submit_tracking_intent";

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
  recheck_status?: string;
  next_priority?: string;
  continue_tracking_reason?: string;
  student_today_action?: string;
  student_minimum_action?: string;
  student_self_check?: string;
  parent_weekly_summary?: string;
  student_weekly_summary?: string;
  continue_tracking_recommended?: boolean;
  continue_tracking_label?: string;
  batch_summary_generated_at?: string;
}

export interface MemorySummary {
  stable_tags: string[];
  repeated_error_tags: string[];
  last_3_weeks_focus: string[];
  last_best_improvement: string;
  next_priority: string;
  next_recheck_reason: string;
  next_action_type: string;
  recheck_status_summary: string;
  last_recheck_at: string | null;
  preferred_tone: string;
  updated_at: string;
}

export interface TrialAccessSnapshot {
  userId: number;
  studentId: number;
  studentName?: string;
  phone: string | null;
  inviteCode: string | null;
  whitelistEnabled?: boolean;
  freeTrialTotal: number;
  freeTrialUsed: number;
  freeTrialRemaining: number;
  maxImagesPerUpload: number;
  enabledGrades: string[];
  enabledSubjects: Subject[];
  gradeOpen: boolean;
  paidTrackingEnabled?: boolean;
  trackingStatus?: TrackingStatus;
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
  submissionType?: SubmissionType;
  recheckTaskId?: number | null;
  recheckStatus?: RecheckTaskStatus;
  recheckOutcome?: RecheckOutcome;
  recheckSummary?: string | null;
  nextPriority?: string | null;
  nextRecheckReason?: string | null;
  nextActionType?: string | null;
  continueTrackingReason?: string | null;
  stabilized?: boolean;
  studentTodayAction?: string | null;
  studentMinimumAction?: string | null;
  studentSelfCheck?: string | null;
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

export interface AppSession {
  userId: number;
  role: string;
  activeStudentId: number | null;
  studentIds: number[];
}

export interface StudentOption {
  id: number;
  userId: number;
  name: string;
  grade: string | null;
  school: string | null;
  nextPriority?: string | null;
}

export interface AdminTrialAccessItem extends TrialAccessSnapshot {
  id: number;
  userName: string;
  grade: string | null;
}

export interface AdminStudentRow {
  studentId: number;
  studentName: string;
  grade: string | null;
  school: string | null;
  parentName: string;
  parentEmail: string;
  latestUploadLabel: string | null;
  latestUploadAt: string | null;
  latestDiagnosisId: number | null;
  latestDiagnosisStage: string | null;
  latestDiagnosisStatus: ReviewStatus | null;
  latestDiagnosisAt: string | null;
  latestWeeklyReportId: number | null;
  recentMemoryTags: string[];
  nextPriority: string | null;
}

export interface AdminActionLog {
  id: number;
  actorName: string;
  actorRole: string;
  actionType: string;
  targetType: string;
  targetId: number | null;
  detail: string;
  createdAt: string;
}

export interface AdminOperationsSnapshot {
  totalCalls: number;
  failedCalls: number;
  estimatedCost: number;
  averageLatencyMs: number;
  latestFailures: ModelCallLogDetail[];
  latestCalls: ModelCallLogDetail[];
  latestActions: AdminActionLog[];
}

export interface RecheckTaskDetail {
  id: number;
  studentId: number;
  studentName?: string | null;
  diagnosisId: number | null;
  weeklyReportId: number | null;
  subject: Subject;
  module: string;
  tag: string;
  status: RecheckTaskStatus;
  triggerType: string;
  triggerReason: string;
  repeatCount7d: number;
  repeatCount30d: number;
  lastSeenAt: string | null;
  lastRecheckAt: string | null;
  stabilizedScore: number;
  stabilized: boolean;
  nextPriority: string;
  nextRecheckReason: string;
  nextActionType: string;
  continueTrackingReason: string;
  lastOutcome: RecheckOutcome;
  attemptCount: number;
  passStreak: number;
  diagnosisMode: DiagnosisMode;
  paidTrackingEnabled: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  latestDiagnosisId?: number | null;
  latestProblemSummary?: string | null;
  latestStudentAction?: string | null;
  manualOverrideStatus?: RecheckManualDecision | null;
  manualOverrideReason?: string | null;
  manualOverridePriority?: string | null;
  manualOverrideBy?: number | null;
  manualOverrideAt?: string | null;
}

export interface RecheckSyncResult {
  task: RecheckTaskDetail | null;
  diagnosisOutcome: RecheckOutcome;
  created: boolean;
  statusChanged: boolean;
  previousStatus: RecheckTaskStatus | null;
  recheckSummary: string;
  nextPriority: string;
  nextRecheckReason: string;
  nextActionType: string;
  continueTrackingReason: string;
  studentTodayAction: string;
  studentMinimumAction: string;
  studentSelfCheck: string;
}

export interface RecheckTaskPageDetail {
  id: number;
  studentId: number;
  studentName: string;
  subject: Subject;
  module: string;
  tag: string;
  status: RecheckTaskStatus;
  lastProblemSummary: string;
  currentGoal: string;
  uploadHint: string;
  compareDiagnosisId: number | null;
  compareWeeklyReportId: number | null;
  latestDiagnosisId: number | null;
  nextPriority: string;
  continueTrackingReason: string;
  studentTodayAction: string;
}

export interface TrackingIntentDetail {
  id: number;
  studentId: number;
  studentName: string;
  parentName: string;
  diagnosisId: number | null;
  recheckTaskId: number | null;
  requestedWeeks: number;
  note: string | null;
  status: TrackingIntentStatus;
  source: string;
  trackingStatus: TrackingStatus;
  submittedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface TrackingClickDetail {
  id: number;
  studentId: number;
  studentName: string;
  parentName: string;
  diagnosisId: number;
  eventName: ResultEventName;
  createdAt: string;
  eventValue: string | null;
}

export interface AdminTrackingSnapshot {
  clicks: TrackingClickDetail[];
  intents: TrackingIntentDetail[];
  activeStudents: TrackingIntentDetail[];
}
