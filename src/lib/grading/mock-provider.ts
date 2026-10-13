import { GradingProvider, GradingInput, GradingOutput, ScriptGradingInput, ScriptGradingOutput } from "./types";
import { validateScoreBounds } from "../scoring/deterministic-calculator";

/**
 * MockGradingProvider
 *
 * Deterministic sample evaluator for testing, local development, and workflow verification.
 * Clearly marked as simulation data.
 */
export class MockGradingProvider implements GradingProvider {
  readonly id = "mock-provider";
  readonly name = "MockGradingProvider (Deterministic Simulation)";
  readonly isMock = true;

  async gradeQuestion(input: GradingInput): Promise<GradingOutput> {
    // Generate deterministic evaluation based on question properties and rubric
    const max = input.maxMarks;
    const qNum = input.questionNumber;

    // Simulate realistic grading variety:
    // e.g. Q1 full marks, Q2 partial marks with criteria breakdown, Q3 flagged uncertainty
    let proposed = max;
    let rationale = "Complete answer demonstrating solid conceptual understanding.";
    let uncertainty: "high_confidence" | "medium_confidence" | "high_uncertainty" = "high_confidence";
    let confidence = 0.95;
    const satisfied: string[] = [];

    if (input.rubricCriteria && input.rubricCriteria.length > 0) {
      if (qNum % 3 === 0) {
        // Partial credit case
        const criteriaToSatisfy = input.rubricCriteria.slice(0, Math.max(1, input.rubricCriteria.length - 1));
        criteriaToSatisfy.forEach((c) => satisfied.push(c.criterion));
        proposed = criteriaToSatisfy.reduce((acc, c) => acc + c.marks, 0);
        rationale = `Addressed ${criteriaToSatisfy.length} of ${input.rubricCriteria.length} required points. Missing justification for final step.`;
        uncertainty = "medium_confidence";
        confidence = 0.78;
      } else if (qNum % 5 === 0) {
        // Handwriting uncertainty case
        proposed = Math.round((max * 0.6) * 10) / 10;
        input.rubricCriteria.slice(0, 1).forEach((c) => satisfied.push(c.criterion));
        rationale = "Script text contains cursive flourish with ambiguous subscripts. Evaluated with cautionary uncertainty flag for teacher verification.";
        uncertainty = "high_uncertainty";
        confidence = 0.52;
      } else {
        // Full credit case
        input.rubricCriteria.forEach((c) => satisfied.push(c.criterion));
        proposed = max;
        rationale = "All rubric checkpoints satisfied with clear derivation and appropriate terminology.";
        uncertainty = "high_confidence";
        confidence = 0.94;
      }
    } else {
      // Default fallback
      if (qNum === 2) {
        proposed = Math.max(1, max - 1);
        rationale = "Minor arithmetic discrepancy in intermediate calculation; method is sound.";
        uncertainty = "medium_confidence";
        confidence = 0.82;
      } else {
        proposed = max;
        rationale = "Candidate provided comprehensive answer matching expected rubric criteria.";
      }
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
      ],
      validationStatus,
      isMock: true,
      providerName: this.name,
      extractedAnswerSnippet: input.studentAnswerText || `[Simulated handwriting extraction for Question ${qNum}]`,
    };
  }

  async gradeScript(input: ScriptGradingInput): Promise<ScriptGradingOutput> {
    const results: GradingOutput[] = [];
    let totalProposed = 0;
    let maxPossible = 0;
    let uncertainCount = 0;

    for (const q of input.questions) {
      const result = await this.gradeQuestion(q);
      results.push(result);
      totalProposed += result.proposedMarks;
      maxPossible += result.maxMarks;
      if (result.uncertaintyStatus === "high_uncertainty") {
        uncertainCount++;
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
      },
    };
  }
}
