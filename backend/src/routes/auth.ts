import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/response.js";
import { AppError } from "../lib/errors.js";
import { createToken } from "../lib/token.js";
import { verifyPassword } from "../lib/password.js";
import { toApiRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../validators/schemas.js";

export const authRouter = Router();

function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: Parameters<typeof toApiRole>[0];
  organizationId: string | null;
  organization: { id: string; name: string; code: string } | null;
  roles?: Array<{
    role: {
      code: string;
      name: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
}) {
  if (!user.organizationId || !user.organization) {
    throw new AppError(500, "ORGANIZATION_MISSING", "账号未绑定机构");
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: toApiRole(user.role),
    roles: user.roles?.map((item) => ({ code: item.role.code, name: item.role.name })) ?? [],
    permissions: [
      ...new Set(user.roles?.flatMap((item) => item.role.permissions.map((rolePermission) => rolePermission.permission.code)) ?? []),
    ],
    organizationId: user.organizationId,
    organization: user.organization,
  };
}

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.passwordHash)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = toAuthUser(user);
    const token = createToken({
      userId: user.id,
      organizationId: authUser.organizationId,
      role: authUser.role,
      displayName: user.displayName,
    });

    return ok(res, { token, user: authUser });
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new AppError(401, "UNAUTHORIZED", "登录已失效");
    return ok(res, { user: toAuthUser(user) });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    return ok(res, { success: true });
  })
);
