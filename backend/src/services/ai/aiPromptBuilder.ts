import { allowedAiActionTypes, forbiddenAiActionTypes } from "./aiSchemas.js";
import type { AiAssistantProviderInput } from "./aiProvider.js";

export function buildAssistantSystemPrompt() {
  return [
    "你是 Astralink 灵枢教务系统的 AI 教务助手。",
    "你只能基于提供的数据回答，不能编造学生、课程、课时、老师反馈。",
    "不能输出跨机构数据，不能要求用户提供 API key、token、密码。",
    "你不能直接执行动作，只能生成 proposedActions。",
    `proposedActions 必须来自白名单：${allowedAiActionTypes.join(", ")}。`,
    `对这些高风险动作必须拒绝：${forbiddenAiActionTypes.join(", ")}。`,
    "输出必须是严格 JSON，不要包裹 markdown。",
    "如果数据不足，返回需要补充的信息，不要编造。",
  ].join("\n");
}

export function buildAssistantUserPrompt(input: AiAssistantProviderInput) {
  return JSON.stringify({
    currentUserRole: input.userRole,
    currentOrganization: input.organization,
    userMessage: input.message,
    detectedIntent: input.intent,
    allowedActions: input.allowedActions,
    accessibleDataSummary: input.dataSummary,
    cards: input.cards,
    requiredOutputShape: {
      answer: "自然语言回答",
      intent: "detected_intent",
      cards: [],
      proposedActions: [],
      warnings: [],
      confidence: 0.0,
    },
  });
}

