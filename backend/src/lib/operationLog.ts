import type { Request } from "express";
import { prisma } from "./prisma.js";

export async function logOperation(
  req: Request,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string;
    detail?: unknown;
  }
) {
  try {
    await prisma.operationLog.create({
      data: {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        detail: input.detail ? JSON.parse(JSON.stringify(input.detail)) : undefined,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
      },
    });
  } catch (error) {
    console.warn(`Operation log failed for ${input.action}:`, error);
  }
}
