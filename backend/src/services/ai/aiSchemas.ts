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

function normalizeActionType(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((allowedAiActionTypes as readonly string[]).includes(normalized)) return normalized;

  if (/PARENT|MESSAGE|COMMUNICATION|家长|话术|提醒/.test(normalized)) return "CREATE_PARENT_MESSAGE";
  if (/ADVISOR|FOLLOW|TASK|顾问|跟进/.test(normalized)) return "CREATE_ADVISOR_FOLLOW_UP";
  if (/RENEWAL|RENEW|续费/.test(normalized)) return "GENERATE_RENEWAL_SUGGESTION";
  if (/POLISH|REPORT|润色|报告/.test(normalized)) return "POLISH_PARENT_REPORT";
  if (/STUDENT.*FOLLOW|FOLLOW.*STUDENT|NEED.*FOLLOW|重点/.test(normalized)) return "MARK_STUDENT_FOLLOW_UP_NEEDED";
  if (/LEAVE|MAKEUP|补课|请假/.test(normalized)) return "CREATE_LEAVE_MAKEUP_NOTE";

  return value;
}

function normalizeProposedAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const action = value as Record<string, unknown>;
  const actionType = normalizeActionType(action.actionType);
  const fallbackTitle = typeof actionType === "string" && actionType in actionTitleMap
    ? actionTitleMap[actionType as keyof typeof actionTitleMap]
    : "AI 建议动作";
  return {
    ...action,
    actionType,
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

const proposedActionsSchema = z.preprocess((value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => aiProposedActionSchema.safeParse(item))
    .filter((result): result is { success: true; data: z.infer<typeof aiProposedActionSchema> } => result.success)
    .map((result) => result.data);
}, z.array(aiProposedActionSchema).default([]));

export const aiProviderResponseSchema = z.object({
  answer: z.string().min(1),
  intent: z.string().min(1),
  cards: z.array(z.record(z.string(), z.unknown())).default([]),
  proposedActions: proposedActionsSchema,
  warnings: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export type AiProposedActionInput = z.infer<typeof aiProposedActionSchema>;
export type AiProviderResponse = z.infer<typeof aiProviderResponseSchema>;
export type AllowedAiActionType = (typeof allowedAiActionTypes)[number];
