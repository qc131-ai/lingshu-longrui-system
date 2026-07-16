import { addMinutes } from "date-fns";
import { AiRiskLevel, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { MockUser } from "../../middleware/auth.js";
import { aiProposedActionSchema, type AiProposedActionInput } from "./aiSchemas.js";
import { isActionAllowedForRole, jsonClone, prismaActionType } from "./aiSafety.js";

function riskLevel(value: AiProposedActionInput["riskLevel"]) {
  if (value === "high") return AiRiskLevel.HIGH;
  if (value === "medium") return AiRiskLevel.MEDIUM;
  return AiRiskLevel.LOW;
}

export async function saveProposedActions(input: {
  user: MockUser;
  proposedActions: unknown[];
  confidence: number;
}) {
  const parsed = input.proposedActions
    .map((action) => aiProposedActionSchema.safeParse(action))
    .filter((result): result is { success: true; data: AiProposedActionInput } => result.success)
    .map((result) => result.data)
    .filter((action) => action.riskLevel !== "high")
    .filter((action) => input.confidence >= 0.5 && isActionAllowedForRole(input.user, action.actionType));

  const created = [];
  for (const action of parsed) {
    const record = await prisma.aiAction.create({
      data: {
        organizationId: input.user.organizationId,
        userId: input.user.id,
        actionType: prismaActionType(action.actionType),
        title: action.title,
        description: action.description,
        payload: jsonClone(action.payload) as Prisma.InputJsonValue,
        riskLevel: riskLevel(action.riskLevel),
        confidence: input.confidence,
        expiresAt: addMinutes(new Date(), 30),
      },
    });
    created.push({
      id: record.id,
      actionType: action.actionType,
      title: record.title,
      description: record.description,
      payload: action.payload,
      status: record.status.toLowerCase(),
      riskLevel: action.riskLevel,
      confidence: Number(record.confidence),
      expiresAt: record.expiresAt.toISOString(),
      requiresConfirmation: true,
    });
  }
  return created;
}

