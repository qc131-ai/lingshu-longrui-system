import type { AIChatHistoryItem, AIQueryResult, Student, RenewalSuggestion } from "../types";
import { aiChatHistory, makeupReminderItems } from "../data/ai";
import { defaultRenewalSuggestion } from "../data/creditMeta";
import { apiClient, createApiCallState } from "./apiClient";

export const aiApiState = {
  query: createApiCallState<AIQueryResult>(),
  renewal: createApiCallState<RenewalSuggestion>(),
};

export const aiService = {
  async getHistory(): Promise<AIChatHistoryItem[]> {
    return [...aiChatHistory];
  },

  /** 解析 AI 助手查询意图并返回结构化结果 */
  async queryAssistant(message: string, students: Student[]): Promise<AIQueryResult> {
    return apiClient.requestWithFallback<AIQueryResult>(
      "/ai/assistant",
      { method: "POST", body: JSON.stringify({ message }) },
      async () => {
        await new Promise((r) => setTimeout(r, 500));
        if (message.includes("课时低于") || message.includes("预警") || message.includes("课时不足")) {
          return {
            intent: "credit_warning",
            students: students.filter((s) => s.remainingCredits <= 5),
          };
        }
        if (message.includes("反馈") || message.includes("报告")) {
          return { intent: "report" };
        }
        if (message.includes("补课")) {
          return {
            intent: "makeup",
            items: makeupReminderItems,
            count: makeupReminderItems.length,
          };
        }
        return {
          intent: "default",
          fallbackText:
            '抱歉，我还在学习中。您可以尝试问我"哪些学生课时低于 5 小时？"或"帮我生成韩梅梅的家长报告"。',
        };
      },
      aiApiState.query
    );
  },

  /** 生成续费建议 */
  async generateRenewalSuggestion(): Promise<RenewalSuggestion> {
    aiApiState.renewal.status = "loading";
    aiApiState.renewal.loading = true;
    await new Promise((r) => setTimeout(r, 500));
    const suggestion = { ...defaultRenewalSuggestion };
    aiApiState.renewal.status = "success";
    aiApiState.renewal.loading = false;
    aiApiState.renewal.data = suggestion;
    return suggestion;
  },

  getHistorySync() {
    return [...aiChatHistory];
  },
};
