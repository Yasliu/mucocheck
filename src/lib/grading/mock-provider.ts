import {
  GradingProvider,
  GradingInput,
  GradingOutput,
  ScriptGradingInput,
  ScriptGradingOutput,
} from "./types";
import { validateScoreBounds } from "../scoring/deterministic-calculator";
import { REPRESENTATIVE_GRADING_FIXTURES } from "./fixtures";

/**
 * MockGradingProvider
 *
 * Deterministic sample evaluator for testing, local development, and workflow verification.
 * Explicitly labeled as simulated fixture data; does not claim real handwriting OCR.
 */
export class MockGradingProvider implements GradingProvider {
  readonly id = "mock-provider";
  readonly name = "MockGradingProvider (Deterministic Simulation)";
  readonly isMock = true;

  async gradeQuestion(input: GradingInput): Promise<GradingOutput> {
    // 1. Direct fixture match if question matches a representative test fixture
    const directFixture = REPRESENTATIVE_GRADING_FIXTURES.find(
      (f) => f.input.questionId === input.questionId
    );
    if (directFixture) {
      return {
        ...directFixture.expectedOutput,
        maxMarks: input.maxMarks,
        extractedAnswerSnippet: input.studentAnswerText || directFixture.input.studentAnswerText,
      };
    }

    // 2. Unmatched Answer case: Never force an answer match
    if (input.isUnmatched || !input.studentAnswerText || input.studentAnswerText.trim().length === 0) {
      return {
        questionId: input.questionId,
        proposedMarks: 0,
        maxMarks: input.maxMarks,
        conciseRationale: "Candidate answer could not be matched to this question. Preserved as unattempted/missing.",
        criteriaSatisfied: [],
        uncertaintyStatus: "high_confidence",
        confidenceScore: 1.0,
        evidenceReferences: [`Script page ${input.scriptPageIndex ?? 1} (No matching text region)`],
        validationStatus: "unmatched",
        isMock: true,
        providerName: this.name,
        extractedAnswerSnippet: "",
        isUnmatched: true,
      };
    }

    // 3. Unreadable / ambiguous handwriting case
    if (input.isUnreadable) {
      const partialMarks = Math.round(input.maxMarks * 0.4 * 10) / 10;
      return {
        questionId: input.questionId,
        proposedMarks: partialMarks,
        maxMarks: input.maxMarks,
        conciseRationale: "Handwriting in this answer region has severe smudging or irregular strokes. Teacher visual verification required.",
        criteriaSatisfied: [],
        uncertaintyStatus: "high_uncertainty",
        confidenceScore: 0.45,
        evidenceReferences: [`Script page ${input.scriptPageIndex ?? 1}, lines 4-8`],
        validationStatus: "uncertain_handwriting",
        isMock: true,
        providerName: this.name,
        extractedAnswerSnippet: input.studentAnswerText,
        isUnreadable: true,
      };
    }

    // 4. Deterministic grading distribution based on question properties and rubric
    const max = input.maxMarks;
    const qNum = input.questionNumber;

    let proposed = max;
    let rationale = "Complete answer demonstrating solid conceptual understanding.";
    let uncertainty: "high_confidence" | "medium_confidence" | "high_uncertainty" = "high_confidence";
    let confidence = 0.95;
    const satisfied: string[] = [];
    let isAlternative = false;
    let isArithmeticSlip = false;

    if (input.rubricCriteria && input.rubricCriteria.length > 0) {
      if (qNum % 4 === 0) {
        // Alternative valid method case
        input.rubricCriteria.forEach((c) => satisfied.push(c.criterion));
        proposed = max;
        rationale = "Candidate used an alternative valid derivation matching the theoretical requirements.";
        isAlternative = true;
        confidence = 0.92;
      } else if (qNum % 3 === 0) {
        // Partial credit case
        const criteriaToSatisfy = input.rubricCriteria.slice(0, Math.max(1, input.rubricCriteria.length - 1));
        criteriaToSatisfy.forEach((c) => satisfied.push(c.criterion));
        proposed = criteriaToSatisfy.reduce((acc, c) => acc + c.marks, 0);
        rationale = `Addressed ${criteriaToSatisfy.length} of ${input.rubricCriteria.length} checkpoints. Missing final concluding explanation.`;
        uncertainty = "medium_confidence";
        confidence = 0.81;
      } else if (qNum % 5 === 0) {
        // Handwriting uncertainty case
        proposed = Math.round(max * 0.6 * 10) / 10;
        input.rubricCriteria.slice(0, 1).forEach((c) => satisfied.push(c.criterion));
        rationale = "Script text contains cursive flourish with ambiguous subscripts. Evaluated with cautionary uncertainty flag for teacher verification.";
        uncertainty = "high_uncertainty";
        confidence = 0.52;
      } else if (qNum === 2) {
        // Arithmetic error case
        input.rubricCriteria.slice(0, Math.max(1, input.rubricCriteria.length - 1)).forEach((c) => satisfied.push(c.criterion));
        proposed = Math.max(1, max - 1.5);
        rationale = "Method is mathematically sound; minor arithmetic discrepancy in final subtraction. Deducted 1.5 marks.";
        isArithmeticSlip = true;
        confidence = 0.89;
      } else {
        // Full credit case
        input.rubricCriteria.forEach((c) => satisfied.push(c.criterion));
        proposed = max;
        rationale = "All rubric checkpoints satisfied with clear derivation and appropriate terminology.";
        uncertainty = "high_confidence";
        confidence = 0.94;
      }
    } else {
      proposed = max;
      rationale = "Candidate provided comprehensive answer matching expected rubric criteria.";
    }

    // Ensure strict boundary validation
    const bounds = validateScoreBounds(proposed, max);
    const validationStatus = !bounds.valid
      ? "flagged_out_of_bounds"
      : uncertainty === "high_uncertainty"
      ? "uncertain_handwriting"
      : "valid";

    return {
      questionId: input.questionId,
      proposedMarks: proposed,
      maxMarks: max,
      conciseRationale: rationale,
      criteriaSatisfied: satisfied,
      uncertaintyStatus: uncertainty,
      confidenceScore: confidence,
      evidenceReferences: [
        `Page ${input.scriptPageIndex ?? 1}, Section ${(qNum % 3) + 1}`,
        ...(input.continuationPages ? input.continuationPages.map((p) => `Page ${p}`) : []),
      ],
      validationStatus,
      isMock: true,
      providerName: this.name,
      extractedAnswerSnippet: input.studentAnswerText || `[Simulated handwriting extraction for Question ${qNum}]`,
      alternativeMethodDetected: isAlternative,
      arithmeticErrorDetected: isArithmeticSlip,
      continuationPages: input.continuationPages,
    };
  }

  async gradeScript(input: ScriptGradingInput): Promise<ScriptGradingOutput> {
    const results: GradingOutput[] = [];
    let totalProposed = 0;
    let maxPossible = 0;
    let uncertainCount = 0;
    let unmatchedCount = 0;

    for (const q of input.questions) {
      const result = await this.gradeQuestion(q);
      results.push(result);
      totalProposed += result.proposedMarks;
      maxPossible += result.maxMarks;
      if (result.uncertaintyStatus === "high_uncertainty") {
        uncertainCount++;
      }
      if (result.isUnmatched) {
        unmatchedCount++;
      }
    }

    return {
      scriptId: input.scriptId,
      studentId: input.studentId,
      results,
      isMock: true,
      providerName: this.name,
      summary: {
        totalProposed: Math.round(totalProposed * 10) / 10,
        maxPossible,
        uncertainQuestionsCount: uncertainCount,
        unmatchedQuestionsCount: unmatchedCount,
      },
    };
  }
}
