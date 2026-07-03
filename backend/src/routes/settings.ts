import { Router } from "express";
import { UserRole, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { requireRoles } from "../middleware/auth.js";
import { logOperation } from "../lib/operationLog.js";
import { toPrismaEnum } from "../lib/enums.js";
import { hashPassword } from "../lib/password.js";
import {
  createUserSchema,
  idParamSchema,
  organizationSettingsSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "../validators/schemas.js";

export const settingsRouter = Router();

const defaultAcademicConfig = {
  lowCreditThreshold: 5,
  defaultLessonHours: 2,
  allowCreditOverdraft: false,
  enableConflictDetection: true,
  enableLeaveApproval: true,
  enableReportReview: true,
};

const defaultNotificationConfig = {
  enableParentNotification: true,
  enableTeacherReminder: true,
  enableAdvisorRenewalReminder: true,
  channels: ["wecom"],
};

const defaultAiConfig = {
  mode: "rule_based",
  enableAssistant: true,
  enableRenewalSuggestion: true,
  enableReportPolish: true,
  apiKeyStatus: "后续配置",
};

const permissionMatrix = [
  ["首页看板", ["admin", "academic_manager", "advisor", "teacher", "finance"], ["view"]],
  ["学员管理", ["admin", "academic_manager", "advisor"], ["view", "create", "edit", "delete", "export"]],
  ["课程产品", ["admin", "academic_manager"], ["view", "create", "edit", "delete", "export"]],
  ["班级管理", ["admin", "academic_manager"], ["view", "create", "edit", "delete", "export"]],
  ["排课日历", ["admin", "academic_manager", "teacher"], ["view", "create", "edit", "delete", "approve"]],
  ["上课记录", ["admin", "academic_manager", "teacher"], ["view", "create", "edit", "confirmDeduction"]],
  ["请假补课", ["admin", "academic_manager"], ["view", "create", "edit", "approve", "send"]],
  ["老师中心", ["admin", "academic_manager"], ["view", "create", "edit", "delete"]],
  ["作业测评", ["admin", "teacher"], ["view", "create", "edit"]],
  ["竞赛项目", ["admin"], ["view", "create", "edit", "delete"]],
  ["家长报告", ["admin", "academic_manager", "advisor"], ["view", "create", "edit", "send", "export"]],
  ["订单课时", ["admin", "advisor", "finance"], ["view", "create", "edit", "export"]],
  ["数据导入", ["admin", "academic_manager", "finance"], ["view", "create", "export"]],
  ["AI 教务助手", ["admin", "academic_manager", "advisor", "teacher", "finance"], ["view", "create"]],
  ["系统设置", ["admin", "academic_manager"], ["view", "edit"]],
] as const;

function mergeConfig<T extends Record<string, unknown>>(defaults: T, value: Prisma.JsonValue | null | undefined) {
  return { ...defaults, ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}) };
}

function toUserRole(role: string) {
  return toPrismaEnum(role) as UserRole;
}

function toUserStatus(status?: string) {
  return (status ? toPrismaEnum(status) : "ACTIVE") as UserStatus;
}

async function getOrCreateSettings(organizationId: string) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, include: { setting: true } });
  if (!organization) throw notFound("Organization");
  const setting = organization.setting ?? await prisma.organizationSetting.create({ data: { organizationId } });
  return { organization, setting };
}

function toSettingsPayload(data: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  const { organization, setting } = data;
  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationCode: organization.code,
    shortName: setting.shortName ?? "",
    phone: setting.phone ?? "",
    email: setting.email ?? "",
    address: setting.address ?? "",
    logoText: setting.logoText ?? "Astralink",
    version: setting.version,
    environment: setting.environment,
    academicConfig: mergeConfig(defaultAcademicConfig, setting.academicConfig),
    notificationConfig: mergeConfig(defaultNotificationConfig, setting.notificationConfig),
    aiConfig: mergeConfig(defaultAiConfig, setting.aiConfig),
    updatedAt: setting.updatedAt,
  };
}

function toUserPayload(user: Prisma.UserGetPayload<{ include: { organization: true; teacherProfile: true; advisorStudents: { select: { id: true } } } }>) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    organizationId: user.organizationId,
    organizationName: user.organization?.name ?? "-",
    teacherId: user.teacherProfile?.id,
    teacherName: user.teacherProfile?.name,
    advisorStudentCount: user.advisorStudents.length,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

settingsRouter.get(
  "/",
  requireRoles("admin", "academic_manager"),
  asyncHandler(async (req, res) => {
    return ok(res, toSettingsPayload(await getOrCreateSettings(req.user.organizationId)));
  })
);

settingsRouter.put(
  "/",
  requireRoles("admin"),
  validate({ body: organizationSettingsSchema }),
  asyncHandler(async (req, res) => {
    const existing = await getOrCreateSettings(req.user.organizationId);
    const input = req.body;
    if (input.organizationName) {
      await prisma.organization.update({ where: { id: req.user.organizationId }, data: { name: input.organizationName } });
    }
    await prisma.organizationSetting.update({
      where: { organizationId: req.user.organizationId },
      data: {
        shortName: input.shortName,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        logoText: input.logoText,
        version: input.version,
        environment: input.environment,
        academicConfig: input.academicConfig ? { ...mergeConfig(defaultAcademicConfig, existing.setting.academicConfig), ...input.academicConfig } : undefined,
        notificationConfig: input.notificationConfig ? { ...mergeConfig(defaultNotificationConfig, existing.setting.notificationConfig), ...input.notificationConfig } : undefined,
        aiConfig: input.aiConfig ? { ...mergeConfig(defaultAiConfig, existing.setting.aiConfig), ...input.aiConfig } : undefined,
      },
    });
    await logOperation(req, { action: "update_system_settings", resourceType: "organization_setting", resourceId: existing.setting.id, detail: Object.keys(input) });
    return ok(res, toSettingsPayload(await getOrCreateSettings(req.user.organizationId)));
  })
);

settingsRouter.get(
  "/permissions",
  requireRoles("admin", "academic_manager"),
  asyncHandler(async (_req, res) => {
    const actions = ["view", "create", "edit", "delete", "export", "approve", "send", "confirmDeduction"];
    return ok(res, {
      roles: ["admin", "academic_manager", "advisor", "teacher", "finance"],
      actions,
      modules: permissionMatrix.map(([module, roles, allowedActions]) => ({
        module,
        permissions: Object.fromEntries(roles.map((role) => [role, Object.fromEntries(actions.map((action) => [action, allowedActions.includes(action as never)]))])),
      })),
    });
  })
);

settingsRouter.get(
  "/users",
  requireRoles("admin", "academic_manager"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      include: { organization: true, teacherProfile: true, advisorStudents: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, users.map(toUserPayload));
  })
);

settingsRouter.post(
  "/users",
  requireRoles("admin"),
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const user = await prisma.user.create({
      data: {
        organizationId: req.user.organizationId,
        email: input.email,
        passwordHash: hashPassword(input.password),
        displayName: input.displayName,
        role: toUserRole(input.role),
        status: toUserStatus(input.status),
      },
      include: { organization: true, teacherProfile: true, advisorStudents: { select: { id: true } } },
    });
    if (input.teacherId) {
      await prisma.teacher.update({ where: { id: input.teacherId }, data: { userId: user.id } });
    }
    await logOperation(req, { action: "create_user", resourceType: "user", resourceId: user.id, detail: { email: user.email, role: input.role } });
    return created(res, toUserPayload(user));
  })
);

settingsRouter.put(
  "/users/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) throw notFound("User");
    if (req.user.role === "academic_manager" && existing.role === UserRole.ADMIN) {
      throw new AppError(403, "FORBIDDEN", "教务主管不能修改管理员账号");
    }
    if (req.user.role !== "admin") throw new AppError(403, "FORBIDDEN", "当前账号无权修改用户");

    const input = req.body;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName,
        role: input.role ? toUserRole(input.role) : undefined,
        status: input.status ? toUserStatus(input.status) : undefined,
      },
      include: { organization: true, teacherProfile: true, advisorStudents: { select: { id: true } } },
    });
    if (input.teacherId !== undefined) {
      await prisma.teacher.updateMany({ where: { organizationId: req.user.organizationId, userId: user.id }, data: { userId: null } });
      if (input.teacherId) await prisma.teacher.update({ where: { id: input.teacherId }, data: { userId: user.id } });
    }
    await logOperation(req, { action: "update_user", resourceType: "user", resourceId: user.id, detail: { fields: Object.keys(input) } });
    return ok(res, toUserPayload(user));
  })
);

settingsRouter.patch(
  "/users/:id/status",
  requireRoles("admin"),
  validate({ params: idParamSchema, body: updateUserSchema.pick({ status: true }) }),
  asyncHandler(async (req, res) => {
    if (!req.body.status) throw badRequest("status is required");
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) throw notFound("User");
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { status: toUserStatus(req.body.status) },
      include: { organization: true, teacherProfile: true, advisorStudents: { select: { id: true } } },
    });
    await logOperation(req, {
      action: req.body.status === "disabled" ? "disable_user" : "enable_user",
      resourceType: "user",
      resourceId: user.id,
      detail: { email: user.email },
    });
    return ok(res, toUserPayload(user));
  })
);

settingsRouter.post(
  "/users/:id/reset-password",
  requireRoles("admin"),
  validate({ params: idParamSchema, body: resetUserPasswordSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) throw notFound("User");
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hashPassword(req.body.password) },
      include: { organization: true, teacherProfile: true, advisorStudents: { select: { id: true } } },
    });
    await logOperation(req, { action: "reset_user_password", resourceType: "user", resourceId: user.id, detail: { email: user.email } });
    return ok(res, toUserPayload(user));
  })
);
