import type { NextFunction, Request, Response } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { verifyToken } from "../lib/token.js";
import { prisma } from "../lib/prisma.js";

export type MockUser = {
  id: string;
  organizationId: string;
  role: "admin" | "academic_manager" | "advisor" | "teacher" | "finance";
  displayName: string;
};

declare global {
  namespace Express {
    interface Request {
      user: MockUser;
    }
  }
}

const roleMap: Record<UserRole, MockUser["role"]> = {
  ADMIN: "admin",
  ACADEMIC_MANAGER: "academic_manager",
  ADVISOR: "advisor",
  TEACHER: "teacher",
  FINANCE: "finance",
};

export async function mockAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "OPTIONS" || req.path === "/health" || req.path === "/api/health" || req.path === "/api/auth/login") {
    return next();
  }

  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, organizationId: payload.organizationId },
      select: { status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return next(new AppError(401, "UNAUTHORIZED", "账号已停用或登录已失效"));
    }
    req.user = {
      id: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role as MockUser["role"],
      displayName: payload.displayName,
    };
    return next();
  }

  return next(new AppError(401, "UNAUTHORIZED", "请先登录"));
}

export function requireRoles(...roles: MockUser["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "当前账号无权执行该操作"));
    }
    return next();
  };
}

export function toApiRole(role: UserRole) {
  return roleMap[role];
}
