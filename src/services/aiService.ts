import type {
  AIChatHistoryItem,
  AIActionExecutionResult,
  AIQueryResult,
  AIProposedAction,
  ParentMessageResult,
  ParentMessageScenario,
  PolishReportResult,
  RenewalSuggestion,
  StudentRiskSummaryResult,
} from "../types";
import { aiChatHistory } from "../data/ai";
import { defaultRenewalSuggestion } from "../data/creditMeta";
import { apiClient, createApiCallState, setApiError, setApiLoading, setApiSuccess } from "./apiClient";
import type { AICard, AIQueryIntent } from "../types";

export const aiApiState = {
  query: createApiCallState<AIQueryResult>(),
  renewal: createApiCallState<RenewalSuggestion>(),
  parentMessage: createApiCallState<ParentMessageResult>(),
  polishReport: createApiCallState<PolishReportResult>(),
  riskSummary: createApiCallState<StudentRiskSummaryResult>(),
};

type LegacyStudent = {
  id?: string;
  name?: string;
  remainingCredits?: number;
  riskStatus?: string;
};

function toText(value: unknown, fallback: string | number = "-") {
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value == null) return fallback;
  return fallback;
}

function normalizeIntent(intent: unknown): AIQueryIntent {
  if (
    intent === "low_credit_students" ||
    intent === "missing_teacher_feedback" ||
    intent === "academic_todo" ||
    intent === "leave_makeup_pending" ||
    intent === "parent_report_pending" ||
    intent === "student_risk" ||
    intent === "unknown"
  ) {
    return intent;
  }
  if (intent === "credit_warning") return "low_credit_students";
  if (intent === "makeup") return "leave_makeup_pending";
  if (intent === "report") return "parent_report_pending";
  return "unknown";
}

function normalizeAiResult(payload: unknown): AIQueryResult {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const intent = normalizeIntent(raw.intent);
  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];
  const cards = rawCards.filter((card): card is AICard => Boolean(card && typeof card === "object")).map((card) => ({
    ...(card as AICard),
    id: String((card as AICard).id ?? crypto.randomUUID()),
    title: String((card as AICard).title ?? "未命名结果"),
    fields: Array.isArray((card as AICard).fields) ? (card as AICard).fields : [],
    actions: Array.isArray((card as AICard).actions) ? (card as AICard).actions : [],
  }));
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  const proposedActions = Array.isArray(raw.proposedActions) ? raw.proposedActions.filter((action): action is AIProposedAction => Boolean(action && typeof action === "object")).map((action) => ({
    ...(action as AIProposedAction),
    id: String((action as AIProposedAction).id ?? crypto.randomUUID()),
    title: String((action as AIProposedAction).title ?? "待确认动作"),
    description: String((action as AIProposedAction).description ?? ""),
    status: (action as AIProposedAction).status ?? "proposed",
    riskLevel: (action as AIProposedAction).riskLevel ?? "low",
    confidence: Number((action as AIProposedAction).confidence ?? 0),
    expiresAt: String((action as AIProposedAction).expiresAt ?? new Date().toISOString()),
    requiresConfirmation: Boolean((action as AIProposedAction).requiresConfirmation ?? true),
  })) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === "string") : [];

  if (cards.length > 0 || typeof raw.answer === "string") {
    return {
      answer: typeof raw.answer === "string" ? raw.answer : "已获取 AI 助手查询结果。",
      intent,
      cards,
      actions,
      proposedActions,
      warnings,
      confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
      relatedData: raw.relatedData && typeof raw.relatedData === "object" ? (raw.relatedData as Record<string, unknown>) : undefined,
    };
  }

  if (Array.isArray(raw.students)) {
    const students = raw.students as LegacyStudent[];
    return {
      answer: `我找到了 ${students.length} 名低课时学生。`,
      intent: "low_credit_students",
      cards: students.map((student, index) => ({
        id: student.id ?? `legacy-student-${index}`,
        type: "low_credit_student",
        title: student.name ?? "未命名学员",
        subtitle: "课时预警",
        priority: student.riskStatus === "high" ? "high" : "medium",
        fields: [
          { label: "学员姓名", value: toText(student.name) },
          { label: "剩余课时", value: toText(student.remainingCredits, 0) },
          { label: "风险等级", value: student.riskStatus === "high" ? "高风险" : "中风险" },
        ],
        actions: [
          { label: "查看学员", type: "navigate", target: "/students" },
          { label: "通知顾问", type: "toast", message: "已生成通知任务" },
        ],
        data: { studentId: student.id },
      })),
      actions: [{ label: "查看订单课时", type: "navigate", target: "/orders" }],
      relatedData: { count: students.length, legacyShape: true },
    };
  }

  if (typeof raw.fallbackText === "string") {
    return { answer: raw.fallbackText, intent: "unknown", cards: [], actions: [], relatedData: { legacyShape: true } };
  }

  return {
    answer: "AI 助手暂时没有返回可展示的数据，请换一个问题再试。",
    intent,
    cards: [],
    actions: [],
    relatedData: { emptyResponse: true },
  };
}

export const aiService = {
  async getHistory(): Promise<AIChatHistoryItem[]> {
    return [...aiChatHistory];
  },

  /** 解析 AI 助手查询意图并返回结构化结果 */
  async queryAssistant(message: string, context?: Record<string, unknown>): Promise<AIQueryResult> {
    setApiLoading(aiApiState.query);
    try {
      const result = await apiClient.request<unknown>("/ai/assistant", {
        method: "POST",
        body: JSON.stringify({ message, context }),
      });
      const normalized = normalizeAiResult(result);
      setApiSuccess(aiApiState.query, normalized);
      return normalized;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "AI 助手请求失败";
      setApiError(aiApiState.query, messageText);
      throw error;
    }
  },

  async queryAgent(message: string, context?: Record<string, unknown>): Promise<AIQueryResult> {
    setApiLoading(aiApiState.query);
    try {
      const result = await apiClient.request<unknown>("/ai/agent", {
        method: "POST",
        body: JSON.stringify({ message, context }),
      });
      const normalized = normalizeAiResult(result);
      setApiSuccess(aiApiState.query, normalized);
      return normalized;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "AI Agent 请求失败";
      setApiError(aiApiState.query, messageText);
      throw error;
    }
  },

  async confirmAction(action: AIProposedAction): Promise<AIActionExecutionResult> {
    return apiClient.request<AIActionExecutionResult>("/ai/actions/confirm", {
      method: "POST",
      body: JSON.stringify({
        actionId: action.id,
        actionType: action.actionType,
        payload: action.payload ?? {},
      }),
    });
  },

  async cancelAction(actionId: string): Promise<{ action: AIProposedAction; message: string }> {
    return apiClient.request<{ action: AIProposedAction; message: string }>(`/ai/actions/${actionId}/cancel`, {
      method: "POST",
    });
  },

  /** 生成续费建议 */
  async generateRenewalSuggestion(input: {
    studentId: string;
    courseId?: string;
    tone?: "professional" | "friendly" | "urgent";
    includeParentMessage?: boolean;
  } = { studentId: "" }): Promise<RenewalSuggestion> {
    if (!input.studentId) return { ...defaultRenewalSuggestion };
    setApiLoading(aiApiState.renewal);
    try {
      const suggestion = await apiClient.request<RenewalSuggestion>("/ai/generate-renewal-suggestion", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setApiSuccess(aiApiState.renewal, suggestion);
      return suggestion;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "续费建议生成失败";
      setApiError(aiApiState.renewal, messageText);
      throw error;
    }
  },

  async generateParentMessage(input: {
    studentId: string;
    scenario: ParentMessageScenario;
    courseId?: string;
    tone?: "professional" | "friendly" | "urgent" | "warm" | "concise";
  }): Promise<ParentMessageResult> {
    setApiLoading(aiApiState.parentMessage);
    try {
      const result = await apiClient.request<ParentMessageResult>("/ai/generate-parent-message", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setApiSuccess(aiApiState.parentMessage, result);
      return result;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "家长沟通话术生成失败";
      setApiError(aiApiState.parentMessage, messageText);
      throw error;
    }
  },

  async polishReport(input: { reportId: string; tone?: "professional" | "warm" | "concise" }): Promise<PolishReportResult> {
    setApiLoading(aiApiState.polishReport);
    try {
      const result = await apiClient.request<PolishReportResult>("/ai/polish-report", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setApiSuccess(aiApiState.polishReport, result);
      return result;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "家长报告润色失败";
      setApiError(aiApiState.polishReport, messageText);
      throw error;
    }
  },

  async generateStudentRiskSummary(input: { studentId: string; periodStart?: string; periodEnd?: string }): Promise<StudentRiskSummaryResult> {
    setApiLoading(aiApiState.riskSummary);
    try {
      const result = await apiClient.request<StudentRiskSummaryResult>("/ai/student-risk-summary", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setApiSuccess(aiApiState.riskSummary, result);
      return result;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "学生风险总结生成失败";
      setApiError(aiApiState.riskSummary, messageText);
      throw error;
    }
  },

  getHistorySync() {
    return [...aiChatHistory];
  },
};
