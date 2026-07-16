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

export const aiProposedActionSchema = z.object({
  actionType: z.enum(allowedAiActionTypes),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  requiresConfirmation: z.literal(true).default(true),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
});

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

