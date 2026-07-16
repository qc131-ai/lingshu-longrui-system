import { aiProviderResponseSchema } from "./aiSchemas.js";
import { buildAssistantSystemPrompt, buildAssistantUserPrompt } from "./aiPromptBuilder.js";
import { createMockAiProvider } from "./mockAiProvider.js";
import type { AiProvider, AiAssistantProviderInput } from "./aiProvider.js";

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

async function callDeepSeek(input: AiAssistantProviderInput) {
  const controller = new AbortController();
  const timeout = Number(process.env.AI_TIMEOUT_MS ?? 30000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildAssistantSystemPrompt() },
          { role: "user", content: buildAssistantUserPrompt(input).slice(0, 24000) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek API failed: ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek response is empty");
    const parsed = JSON.parse(extractJson(content)) as unknown;
    return aiProviderResponseSchema.parse(parsed);
  } finally {
    clearTimeout(timer);
  }
}

export function createDeepSeekProvider(): AiProvider {
  const fallback = createMockAiProvider();
  return {
    async generateAssistantResponse(input) {
      try {
        return await callDeepSeek(input);
      } catch (error) {
        console.warn("DeepSeek provider fallback:", error);
        const result = await fallback.generateAssistantResponse(input);
        return {
          ...result,
          warnings: [...result.warnings, "DeepSeek 暂不可用，已使用安全规则型 fallback。"],
        };
      }
    },
    generateRenewalSuggestion: fallback.generateRenewalSuggestion,
    generateParentMessage: fallback.generateParentMessage,
    polishReport: fallback.polishReport,
    generateRiskSummary: fallback.generateRiskSummary,
  };
}

