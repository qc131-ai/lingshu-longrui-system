import { z } from "zod";

export const allowedAiActionTypes = [
  "CREATE_PARENT_MESSAGE",
  "CREATE_ADVISOR_FOLLOW_UP",
  "GENERATE_RENEWAL_SUGGESTION",
  "POLISH_PARENT_REPORT",
  "MARK_STUDENT_FOLLOW_UP_NEEDED",
  "CREATE_LEAVE_MAKEUP_NOTE",
] as const;

export const forbiddenAiActionTypes = [
  "DELETE_ANYTHING",
  "UPDATE_CREDIT_BALANCE",
  "CONFIRM_CREDIT_DEDUCTION",
  "SEND_PARENT_REPORT",
  "SEND_MESSAGE_TO_PARENT",
  "CHANGE_USER_ROLE",
  "RESET_PASSWORD",
  "CREATE_USER",
  "UPDATE_ORGANIZATION_SETTINGS",
  "EXPORT_DATA",
] as const;

const actionTitleMap: Record<(typeof allowedAiActionTypes)[number], string> = {
  CREATE_PARENT_MESSAGE: "生成家长沟通话术",
  CREATE_ADVISOR_FOLLOW_UP: "创建顾问跟进任务",
  GENERATE_RENEWAL_SUGGESTION: "生成续费建议",
  POLISH_PARENT_REPORT: "润色家长报告草稿",
  MARK_STUDENT_FOLLOW_UP_NEEDED: "标记学生需要顾问跟进",
  CREATE_LEAVE_MAKEUP_NOTE: "生成请假补课处理备注",
};

function normalizeProposedAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const action = value as Record<string, unknown>;
  const actionType = action.actionType;
  const fallbackTitle = typeof actionType === "string" && actionType in actionTitleMap
    ? actionTitleMap[actionType as keyof typeof actionTitleMap]
    : "AI 建议动作";
  return {
    ...action,
    title: typeof action.title === "string" && action.title.trim() ? action.title : fallbackTitle,
    description: typeof action.description === "string" && action.description.trim()
      ? action.description
      : `${fallbackTitle}，本阶段仅展示，不会自动执行。`,
    payload: action.payload && typeof action.payload === "object" && !Array.isArray(action.payload) ? action.payload : {},
    requiresConfirmation: true,
    riskLevel: action.riskLevel ?? "low",
  };
}

export const aiProposedActionSchema = z.preprocess(normalizeProposedAction, z.object({
  actionType: z.enum(allowedAiActionTypes),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  requiresConfirmation: z.literal(true).default(true),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
}));

export const aiProviderResponseSchema = z.object({
  answer: z.string().min(1),
  intent: z.string().min(1),
  cards: z.array(z.record(z.string(), z.unknown())).default([]),
  proposedActions: z.array(aiProposedActionSchema).default([]),
  warnings: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export type AiProposedActionInput = z.infer<typeof aiProposedActionSchema>;
export type AiProviderResponse = z.infer<typeof aiProviderResponseSchema>;
export type AllowedAiActionType = (typeof allowedAiActionTypes)[number];
