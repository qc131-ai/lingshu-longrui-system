import { AiActionType, type Prisma } from "@prisma/client";
import type { MockUser } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import type { AllowedAiActionType } from "./aiSchemas.js";

export function prismaActionType(actionType: AllowedAiActionType): AiActionType {
  return actionType as AiActionType;
}

export function isActionAllowedForRole(user: MockUser, actionType: AllowedAiActionType) {
  if (user.role === "admin") return true;
  if (user.role === "academic_manager") return true;
  if (user.role === "advisor") {
    return ["CREATE_PARENT_MESSAGE", "CREATE_ADVISOR_FOLLOW_UP", "GENERATE_RENEWAL_SUGGESTION", "MARK_STUDENT_FOLLOW_UP_NEEDED"].includes(actionType);
  }
  if (user.role === "teacher") {
    return actionType === "POLISH_PARENT_REPORT" || actionType === "CREATE_LEAVE_MAKEUP_NOTE";
  }
  return false;
}

export function assertActionAllowedForRole(user: MockUser, actionType: AllowedAiActionType) {
  if (!isActionAllowedForRole(user, actionType)) {
    throw new AppError(403, "FORBIDDEN", "当前账号无权确认该 AI 动作");
  }
}

export function jsonClone(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

