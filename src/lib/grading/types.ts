import { RubricCriterion, UncertaintyStatus } from "../types";

// Stage 1: Question Paper Analysis
export interface QuestionPaperAnalysis {
  paperId: string;
  detectedQuestions: Array<{
    questionNumber: number;
    promptText: string;
    maxMarks: number;
    pageNumber: number;
  }>;
  totalMaxMarks: number;
  analyzedAt: string;
}

// Stage 2: Marking Scheme Analysis
export interface MarkingSchemeAnalysis {
  schemeId: string;
  rubricRules: Array<{
    questionNumber: number;
    criteria: RubricCriterion[];
    modelAnswerSnippet?: string;
  }>;
  analyzedAt: string;
}

// Stage 3: Answer Region Extraction
export interface AnswerRegionExtraction {
  regionId: string;
  pageNumber: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  extractedCandidateText: string;
  legibilityScore: number; // 0.0 - 1.0
  isUnreadable: boolean;
  continuationNextPage?: boolean;
}

// Stage 4: Question to Answer Matching
export interface QuestionAnswerMatch {
  matchedQuestionNumber: number | null; // null if unmatched or ambiguous
  matchingConfidence: number; // 0.0 - 1.0
  isUncertain: boolean;
  isOutOfOrder: boolean;
  notes?: string;
}

// Stage 5: Rubric-Based Grading Input and Output
export interface GradingInput {
  questionId: string;
  questionNumber: number;
  questionText: string;
  maxMarks: number;
  rubricCriteria: RubricCriterion[];
  modelAnswer?: string;
  studentAnswerText?: string;
  scriptImageReference?: string;
  scriptPageIndex?: number;
  continuationPages?: number[];
  extractionConfidence?: number;
  studentId: string;
  studentName?: string;
  isOutOfOrder?: boolean;
  isUnmatched?: boolean;
  isUnreadable?: boolean;
}

export interface GradingOutput {
  questionId: string;
  proposedMarks: number;
  maxMarks: number;
  conciseRationale: string;
  criteriaSatisfied: string[];
  uncertaintyStatus: UncertaintyStatus;
  confidenceScore: number; // 0.0 - 1.0
  evidenceReferences: string[];
  validationStatus: "valid" | "flagged_out_of_bounds" | "uncertain_handwriting" | "unmatched" | "unreadable";
  isMock: boolean;
  providerName: string;
  extractedAnswerSnippet?: string;
  isUnmatched?: boolean;
  isUnreadable?: boolean;
  alternativeMethodDetected?: boolean;
  arithmeticErrorDetected?: boolean;
  continuationPages?: number[];
}

export interface ScriptGradingInput {
  assessmentId: string;
  scriptId: string;
  studentId: string;
  studentName: string;
  filePath: string;
  questions: GradingInput[];
}

export interface ScriptGradingOutput {
  scriptId: string;
  studentId: string;
  results: GradingOutput[];
  isMock: boolean;
  providerName: string;
  summary: {
    totalProposed: number;
    maxPossible: number;
    uncertainQuestionsCount: number;
    unmatchedQuestionsCount: number;
  };
}

export interface GradingProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  gradeQuestion(input: GradingInput): Promise<GradingOutput>;
  gradeScript(input: ScriptGradingInput): Promise<ScriptGradingOutput>;
}
