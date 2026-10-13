import { RubricCriterion, UncertaintyStatus } from "../types";

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
  extractionConfidence?: number;
  studentId: string;
  studentName?: string;
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
  validationStatus: "valid" | "flagged_out_of_bounds" | "uncertain_handwriting";
  isMock: boolean;
  providerName: string;
  extractedAnswerSnippet?: string;
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
  };
}

export interface GradingProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  gradeQuestion(input: GradingInput): Promise<GradingOutput>;
  gradeScript(input: ScriptGradingInput): Promise<ScriptGradingOutput>;
}
