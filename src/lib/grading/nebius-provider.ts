import { GradingProvider, GradingInput, GradingOutput, ScriptGradingInput, ScriptGradingOutput } from "./types";
import { validateScoreBounds } from "../scoring/deterministic-calculator";

export interface NebiusProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * NebiusTokenFactoryGradingProvider
 *
 * Integration wrapper for NVIDIA open-source models hosted via Nebius Token Factory
 * (e.g., nvidia/llama-3.1-nemotron-70b-instruct or nvidia/nemotron-mini-4b-instruct).
 *
 * Strictly blocks fabricated responses when unconfigured or pending review.
 */
export class NebiusTokenFactoryGradingProvider implements GradingProvider {
  readonly id = "nebius-token-factory";
  readonly name = "Nebius Token Factory (NVIDIA Open-Source LLM)";
  readonly isMock = false;

  private apiKey: string | null;
  private baseUrl: string;
  private modelName: string;

  constructor(config?: NebiusProviderConfig) {
    this.apiKey = config?.apiKey || process.env.NEBIUS_API_KEY || null;
    this.baseUrl = config?.baseUrl || process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.ai/v1";
    this.modelName = config?.modelName || process.env.NEBIUS_MODEL_NAME || "nvidia/llama-3.1-nemotron-70b-instruct";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async gradeQuestion(input: GradingInput): Promise<GradingOutput> {
    if (!this.isConfigured()) {
      throw new Error(
        "Nebius Token Factory integration is not configured or awaiting team account review. " +
        "Please provide a valid NEBIUS_API_KEY or switch to MockGradingProvider in Settings."
      );
    }

    // Real API integration payload structure for Nebius Token Factory / OpenAI-compatible endpoint
    const systemPrompt = `You are a rigorous, fair educational assessment evaluator. 
Evaluate the student's handwritten answer strictly against the provided question rubric.
Rules:
1. Never exceed the maximum marks allowed (${input.maxMarks}).
2. Provide a concise, constructive rationale.
3. Explicitly report criteria satisfied.
4. If handwriting is illegible or ambiguous, flag uncertainty explicitly.
Output JSON only with keys: proposedMarks (number), rationale (string), criteriaSatisfied (string array), confidenceScore (number 0.0-1.0), uncertaintyStatus ("high_confidence"|"medium_confidence"|"high_uncertainty").`;

    const userContent = JSON.stringify({
      questionNumber: input.questionNumber,
      questionText: input.questionText,
      maxMarks: input.maxMarks,
      rubricCriteria: input.rubricCriteria,
      modelAnswer: input.modelAnswer,
      studentAnswerText: input.studentAnswerText,
      scriptImageRef: input.scriptImageReference,
      pageIndex: input.scriptPageIndex,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nebius Token Factory API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response received from Nebius Token Factory.");
      }

      const parsed = JSON.parse(content);
      const proposed = typeof parsed.proposedMarks === "number" ? parsed.proposedMarks : 0;

      // Validate bounds strictly
      const validation = validateScoreBounds(proposed, input.maxMarks);
      if (!validation.valid) {
        throw new Error(`Model returned invalid score: ${validation.error}`);
      }

      return {
        questionId: input.questionId,
        proposedMarks: proposed,
        maxMarks: input.maxMarks,
        conciseRationale: parsed.rationale || "Evaluated by Nebius model.",
        criteriaSatisfied: Array.isArray(parsed.criteriaSatisfied) ? parsed.criteriaSatisfied : [],
        uncertaintyStatus: parsed.uncertaintyStatus || "medium_confidence",
        confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.85,
        evidenceReferences: [`Script page ${input.scriptPageIndex ?? 1}`],
        validationStatus: "valid",
        isMock: false,
        providerName: `${this.name} [${this.modelName}]`,
        extractedAnswerSnippet: input.studentAnswerText,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Nebius Grading failed: ${msg}`);
    }
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
      isMock: false,
      providerName: this.name,
      summary: {
        totalProposed: Math.round(totalProposed * 10) / 10,
        maxPossible,
        uncertainQuestionsCount: uncertainCount,
      },
    };
  }
}
