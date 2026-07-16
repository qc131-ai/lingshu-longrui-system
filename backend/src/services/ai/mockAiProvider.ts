import { aiProviderResponseSchema, type AiProviderResponse } from "./aiSchemas.js";
import type { AiProvider, AiAssistantProviderInput } from "./aiProvider.js";

function firstCardData(input: AiAssistantProviderInput) {
  const card = input.cards.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const data = card?.data && typeof card.data === "object" ? (card.data as Record<string, unknown>) : {};
  return { card, data };
}

function buildRuleBasedActions(input: AiAssistantProviderInput): AiProviderResponse["proposedActions"] {
  const message = input.message;
  const { card, data } = firstCardData(input);
  const title = typeof card?.title === "string" ? card.title : "相关学员";
  const studentId = typeof data.studentId === "string" ? data.studentId : undefined;
  const courseId = typeof data.courseId === "string" ? data.courseId : undefined;
  const reportId = typeof data.reportId === "string" ? data.reportId : undefined;
  const requestId = typeof data.requestId === "string" ? data.requestId : undefined;
  const actions: AiProviderResponse["proposedActions"] = [];

  if (studentId && /(家长|话术|提醒|低课时|续费)/.test(message)) {
    actions.push({
      actionType: "CREATE_PARENT_MESSAGE",
      title: "生成家长沟通话术",
      description: `给${title}家长生成低课时或续费提醒话术`,
      payload: {
        studentId,
        courseId,
        scenario: /低课时/.test(message) ? "low_credit_reminder" : "renewal_followup",
        message: `您好，${title}目前课程剩余课时较低，建议我们提前规划后续学习安排，避免学习节奏中断。`,
      },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }
  if (studentId && /(顾问|跟进|重点|风险|续费)/.test(message)) {
    actions.push({
      actionType: "CREATE_ADVISOR_FOLLOW_UP",
      title: "创建顾问跟进任务",
      description: `为${title}创建顾问跟进提醒`,
      payload: { studentId, courseId, note: `请顾问跟进${title}的课程续费或风险事项。` },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }
  if (studentId && /(续费建议|续费方案)/.test(message)) {
    actions.push({
      actionType: "GENERATE_RENEWAL_SUGGESTION",
      title: "生成续费建议",
      description: `为${title}生成续费建议草稿`,
      payload: { studentId, courseId, suggestion: `建议结合${title}近期学习反馈和剩余课时，安排一次阶段复盘沟通。` },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }
  if (reportId && /(润色|报告)/.test(message)) {
    actions.push({
      actionType: "POLISH_PARENT_REPORT",
      title: "润色家长报告草稿",
      description: `润色${title}的家长报告，不直接发送`,
      payload: { reportId, polishedContent: "已根据当前报告内容生成更适合家长阅读的表达草稿。" },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }
  if (studentId && /(标记|重点跟进|需要跟进)/.test(message)) {
    actions.push({
      actionType: "MARK_STUDENT_FOLLOW_UP_NEEDED",
      title: "标记学生需要顾问跟进",
      description: `标记${title}需要顾问跟进`,
      payload: { studentId, reason: "AI 识别为需要顾问跟进" },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }
  if (requestId && /(补课|请假|处理备注)/.test(message)) {
    actions.push({
      actionType: "CREATE_LEAVE_MAKEUP_NOTE",
      title: "生成请假补课处理备注",
      description: `给${title}的请假补课申请生成处理备注`,
      payload: { leaveMakeupRequestId: requestId, note: "建议先确认补课时间、老师安排和家长通知状态。" },
      requiresConfirmation: true,
      riskLevel: "low",
    });
  }

  return actions.slice(0, 3);
}

export function createMockAiProvider(): AiProvider {
  return {
    async generateAssistantResponse(input) {
      return aiProviderResponseSchema.parse({
        answer: input.cards.length > 0 ? "我已基于当前机构真实数据整理结果，并生成可确认的建议动作。" : "当前没有足够数据生成可执行动作。",
        intent: input.intent,
        cards: input.cards,
        proposedActions: buildRuleBasedActions(input),
        warnings: [],
        confidence: input.cards.length > 0 ? 0.82 : 0.45,
      });
    },
    async generateRenewalSuggestion(input) {
      return input;
    },
    async generateParentMessage(input) {
      return input;
    },
    async polishReport(input) {
      return input;
    },
    async generateRiskSummary(input) {
      return input;
    },
  };
}

