/**
 * Understanding Map Domain Model
 * Structured metadata representing the interpreted syllabus, question paper,
 * and marking scheme hierarchy for Cambridge IGCSE 0580 and general assessments.
 *
 * The original uploaded Question Paper and Marking Scheme remain authoritative.
 * This model preserves immutable links to original source pages and normalized coordinates.
 */

export type UnderstandingMapStatus = "not_generated" | "proposed" | "verified" | "stale";

export type CambridgeMarkType = "M" | "A" | "B" | "SC" | "generic";

/**
 * Normalized Bounding Box (0.0 to 1.0)
 * Completely invariant to viewer zoom level, screen DPI, and 90-degree rotations.
 */
export interface NormalizedBoundingBox {
  x: number;      // 0.0 - 1.0 (left fraction relative to page width)
  y: number;      // 0.0 - 1.0 (top fraction relative to page height)
  width: number;  // 0.0 - 1.0 (width fraction relative to page width)
  height: number; // 0.0 - 1.0 (height fraction relative to page height)
}

/**
 * Link to authoritative source document page and optional bounding region.
 */
export interface DocumentReference {
  document_type: "question_paper" | "marking_scheme";
  document_name?: string;
  document_path?: string;
  page: number; // 1-based page number in document
  bbox?: NormalizedBoundingBox;
}

/**
 * Individual marking criterion or checkpoint (supporting Cambridge 0580 rules).
 */
export interface MarkingCriterionItem {
  id: string;
  mark_type: CambridgeMarkType;
  marks: number;
  description: string;
  guidance?: string;
  is_follow_through?: boolean; // FT rule: credit awarded if followed correctly from earlier error
  dependent_on?: string;       // ID of prerequisite criterion (e.g. A1 dependent on M1)
  source_ref?: DocumentReference;
}

/**
 * Visual element (diagram, figure, grid) reference in source question paper.
 */
export interface DiagramReference {
  has_diagram: boolean;
  diagram_type?:
    | "geometry"
    | "coordinate_grid"
    | "function_graph"
    | "statistical_chart"
    | "table"
    | "tree_diagram"
    | "venn_diagram"
    | "other";
  description?: string;
  page?: number;
  bbox?: NormalizedBoundingBox;
}

/**
 * Node in the question hierarchy (supports parent questions and nested sub-questions).
 * e.g. Question 12 -> 12(a) -> 12(a)(i)
 */
export interface UnderstandingMapQuestionNode {
  id: string;                    // Stable unique node identifier (e.g. "q1", "q5a", "q12bi")
  question_number: number;       // Root question number (e.g. 1, 5, 12)
  sub_label?: string;            // Sub-question label (e.g. "(a)", "(b)(i)")
  full_label: string;            // Canonical combined label (e.g. "1", "5(a)", "12(b)(i)")
  parent_id?: string;            // Parent node ID if nested
  title?: string;                // Short topic or prompt summary (e.g. "Trigonometry - Sine Rule")
  max_marks: number;             // Maximum marks for this node (sum of criteria or sub-questions)

  // Authoritative document page links
  question_paper_ref?: DocumentReference;
  marking_scheme_ref?: DocumentReference;

  // Visual & Mathematical Context
  diagram?: DiagramReference;
  formulae?: string[];           // Mathematical expressions or formulas involved

  // Expected answer & rubric checkpoints
  expected_answer?: string;
  acceptable_equivalents?: string[];
  marking_criteria: MarkingCriterionItem[];

  // Ambiguity & Unresolved items (strictly explicit, no fabrication)
  is_ambiguous?: boolean;
  unresolved_reasons?: string[];

  // Teacher manual override / adjustments
  teacher_override?: {
    adjusted_max_marks?: number;
    custom_criteria?: string;
    notes?: string;
  };

  // Nested child sub-questions (if this node is a composite question)
  sub_questions?: UnderstandingMapQuestionNode[];
}

/**
 * Authoritative document binding fingerprint to detect document changes.
 */
export interface SourceDocumentFingerprint {
  path: string;
  name?: string;
  fingerprint: string;
  total_pages?: number;
}

/**
 * Root Assessment Understanding Map
 * Reusable across multiple student answer scripts for the same assessment.
 */
export interface AssessmentUnderstandingMap {
  id: string;
  assessment_id: string;
  version: number;
  status: UnderstandingMapStatus;

  // Source document bindings
  source_question_paper: SourceDocumentFingerprint;
  source_marking_scheme: SourceDocumentFingerprint;

  // Syllabus / Exam metadata (e.g. Cambridge IGCSE Mathematics 0580/21)
  syllabus_code?: string; // e.g. "0580"
  paper_code?: string;    // e.g. "0580/21"
  exam_session?: string;  // e.g. "May/June 2022"

  // Aggregate metrics
  total_max_marks: number;
  total_questions_count: number; // Count of individual gradable leaf questions

  // Tree of interpreted question nodes
  nodes: UnderstandingMapQuestionNode[];

  // Uncertainty & Ambiguity tracking
  unresolved_items_count: number;
  has_ambiguities: boolean;

  // Teacher verification & audit
  verified_by?: string;
  verified_at?: string;
  teacher_notes?: string;

  created_at: string;
  updated_at: string;
}
