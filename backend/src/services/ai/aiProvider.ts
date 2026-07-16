import { createDeepSeekProvider } from "./deepseekProvider.js";
import { createMockAiProvider } from "./mockAiProvider.js";
import type { AiProviderResponse } from "./aiSchemas.js";

export type AiAssistantProviderInput = {
  message: string;
  intent: string;
  userRole: string;
  organization: { id: string; name?: string; code?: string };
  dataSummary: Record<string, unknown>;
  cards: unknown[];
  allowedActions: string[];
};

export type AiProvider = {
  generateAssistantResponse(input: AiAssistantProviderInput): Promise<AiProviderResponse>;
  generateRenewalSuggestion(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  generateParentMessage(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  polishReport(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  generateRiskSummary(input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export function getAiProvider() {
  const provider = process.env.AI_PROVIDER ?? "mock";
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (provider === "deepseek" && apiKey) return createDeepSeekProvider();
  return createMockAiProvider();
}

