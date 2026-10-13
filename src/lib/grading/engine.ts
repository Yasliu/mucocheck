import { GradingProvider, ScriptGradingInput, ScriptGradingOutput } from "./types";
import { MockGradingProvider } from "./mock-provider";
import { NebiusTokenFactoryGradingProvider } from "./nebius-provider";

export class GradingEngine {
  private static instance: GradingEngine;
  private mockProvider: MockGradingProvider;
  private nebiusProvider: NebiusTokenFactoryGradingProvider;

  private constructor() {
    this.mockProvider = new MockGradingProvider();
    this.nebiusProvider = new NebiusTokenFactoryGradingProvider();
  }

  public static getInstance(): GradingEngine {
    if (!GradingEngine.instance) {
      GradingEngine.instance = new GradingEngine();
    }
    return GradingEngine.instance;
  }

  public getProvider(preferredMode: "mock" | "nebius" = "mock"): GradingProvider {
    if (preferredMode === "nebius") {
      if (this.nebiusProvider.isConfigured()) {
        return this.nebiusProvider;
      }
      // If unconfigured, fall back to clearly flagged mock provider
      return this.mockProvider;
    }
    return this.mockProvider;
  }

  public getProviderStatus(): {
    activeProviderName: string;
    isMock: boolean;
    nebiusConfigured: boolean;
    nebiusModel: string;
    note: string;
  } {
    const nebiusConfigured = this.nebiusProvider.isConfigured();
    return {
      activeProviderName: nebiusConfigured
        ? "Nebius Token Factory (NVIDIA Open-Source)"
        : "MockGradingProvider (Simulation Mode)",
      isMock: !nebiusConfigured,
      nebiusConfigured,
      nebiusModel: process.env.NEBIUS_MODEL_NAME || "nvidia/llama-3.1-nemotron-70b-instruct",
      note: nebiusConfigured
        ? "Live NVIDIA model connected via Nebius Token Factory."
        : "Team account review pending. Running transparent deterministic simulation.",
    };
  }

  public async evaluateScript(
    input: ScriptGradingInput,
    preferredMode: "mock" | "nebius" = "mock"
  ): Promise<ScriptGradingOutput> {
    const provider = this.getProvider(preferredMode);
    return await provider.gradeScript(input);
  }
}

export const gradingEngine = GradingEngine.getInstance();
