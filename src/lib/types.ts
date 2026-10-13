export type ApprovalStatus = "draft" | "proposed" | "needs_review" | "approved";

export type UncertaintyStatus = "high_confidence" | "medium_confidence" | "high_uncertainty";

export interface RubricCriterion {
  id: string;
  criterion: string;
  marks: number;
  guidance?: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_number: number;
  question_text: string;
  max_marks: number;
  rubric_criteria: RubricCriterion[];
  model_answer?: string;
}

export interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  school_name: string;
  department: string;
  rounding_mode: "half_up" | "floor" | "ceil";
  grade_bands: GradeBand[];
  default_max_marks: number;
  provider_mode: "mock" | "nebius";
  nebius_model: string;
  nebius_api_key_configured: boolean;
}

export interface GradeBand {
  grade: string;
  min_pct: number;
  max_pct: number;
  descriptor: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade_level: string;
  section: string;
  academic_year: string;
  student_count?: number;
  created_at: string;
}

export interface Student {
  id: string;
  class_id: string;
  roll_number: string;
  full_name: string;
  email?: string;
  created_at: string;
}

export type AssessmentStatus =
  | "draft"
  | "ready"
  | "processing"
  | "awaiting_review"
  | "completed";

export interface Assessment {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  section: string;
  class_id?: string;
  max_marks: number;
  status: AssessmentStatus;
  date: string;
  question_paper_path?: string;
  question_paper_name?: string;
  marking_scheme_path?: string;
  marking_scheme_name?: string;
  total_scripts: number;
  graded_scripts: number;
  approved_scripts: number;
  created_at: string;
}

export interface StudentScript {
  id: string;
  assessment_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  page_count: number;
  status: "uploaded" | "processing" | "needs_review" | "graded" | "approved";
  total_score: number | null;
  max_score: number;
  percentage: number | null;
  uploaded_at: string;
  simulated_sample_image?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: "edited_mark" | "approved" | "rejected" | "flagged_unreadable" | "corrected_match";
  teacher_name: string;
  previous_score?: number | null;
  new_score?: number | null;
  reason?: string;
  previous_question_id?: string;
  new_question_id?: string;
}

export interface GradingResult {
  id: string;
  assessment_id: string;
  script_id: string;
  question_id: string;
  student_id: string;
  proposed_score: number;
  approved_score: number | null;
  rationale: string;
  uncertainty_status: UncertaintyStatus;
  confidence_score: number; // 0.0 - 1.0
  criteria_satisfied: string[];
  feedback: string;
  status: ApprovalStatus;
  is_mock: boolean;
  edited_by_teacher: boolean;
  answer_extracted_text?: string;
  script_page_index?: number;
  continuation_pages?: number[];
  is_unmatched?: boolean;
  is_unreadable?: boolean;
  unreadable_reason?: string;
  alternative_method_detected?: boolean;
  arithmetic_error_detected?: boolean;
  audit_history?: AuditRecord[];
  created_at: string;
  updated_at: string;
}

export interface MarkbookRow {
  student: Student;
  script?: StudentScript;
  question_scores: Record<
    string,
    {
      proposed_score: number;
      approved_score: number | null;
      status: ApprovalStatus;
      is_mock: boolean;
      uncertainty_status: UncertaintyStatus;
      grading_result_id?: string;
    }
  >;
  raw_total: number | null;
  percentage: number | null;
  converted_total?: number | null;
  approval_status: ApprovalStatus;
  has_unattempted_or_missing: boolean;
}

export interface ReportCardRecord {
  student: Student;
  class_group?: ClassGroup;
  assessments: {
    assessment: Assessment;
    raw_score: number | null;
    max_marks: number;
    percentage: number | null;
    converted_marks: number | null;
    grade_band: string;
    is_missing: boolean;
    teacher_notes?: string;
  }[];
  overall_percentage: number | null;
  overall_grade: string;
  total_assessments: number;
  completed_assessments: number;
  missing_assessments: number;
}
