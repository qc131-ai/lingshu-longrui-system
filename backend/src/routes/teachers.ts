import { Router } from "express";
import { TeacherType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { toTeacher } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { createTeacherSchema, idParamSchema, updateTeacherSchema } from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { teacherProfileId } from "../lib/accessScope.js";

export const teachersRouter = Router();

const include = {
  classes: { select: { id: true, name: true } },
} as const;

teachersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownTeacherId = await teacherProfileId(req.user);
    const teachers = await prisma.teacher.findMany({
      where: {
        organizationId: req.user.organizationId,
        id: req.user.role === "teacher" ? ownTeacherId ?? "__no_teacher_profile__" : undefined,
      },
      include,
      orderBy: { createdAt: "desc" },
    });
    return ok(res, teachers.map(toTeacher));
  })
);

teachersRouter.post(
  "/",
  requireRoles("admin", "academic_manager"),
  validate({ body: createTeacherSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const teacher = await prisma.teacher.create({
      data: {
        organizationId: req.user.organizationId,
        userId: input.userId,
        name: input.name,
        subjects: input.subjects,
        type: toPrismaEnum(input.type) as TeacherType,
        rating: input.rating,
        availableTime: input.availableTime,
        feedbackRate: input.feedbackRate,
        status: input.status ?? "active",
      },
      include,
    });
    await logOperation(req, {
      action: "create_teacher",
      resourceType: "teacher",
      resourceId: teacher.id,
      detail: { name: teacher.name },
    });
    return created(res, toTeacher(teacher));
  })
);

teachersRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const ownTeacherId = await teacherProfileId(req.user);
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        ...(req.user.role === "teacher" ? { id: ownTeacherId ?? "__no_teacher_profile__" } : {}),
      },
      include,
    });
    if (!teacher) throw notFound("Teacher");
    return ok(res, toTeacher(teacher));
  })
);

teachersRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ params: idParamSchema, body: updateTeacherSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const ownTeacherId = await teacherProfileId(req.user);
    const existing = await prisma.teacher.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        ...(req.user.role === "teacher" ? { id: ownTeacherId ?? "__no_teacher_profile__" } : {}),
      },
    });
    if (!existing) throw notFound("Teacher");
    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: {
        userId: req.user.role === "teacher" ? undefined : input.userId,
        name: input.name,
        subjects: input.subjects,
        type: input.type ? (toPrismaEnum(input.type) as TeacherType) : undefined,
        rating: input.rating,
        availableTime: input.availableTime,
        feedbackRate: req.user.role === "teacher" ? undefined : input.feedbackRate,
        status: req.user.role === "teacher" ? undefined : input.status,
      },
      include,
    });
    await logOperation(req, {
      action: "update_teacher",
      resourceType: "teacher",
      resourceId: teacher.id,
      detail: input,
    });
    return ok(res, toTeacher(teacher));
  })
);

teachersRouter.delete(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Teacher");
    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: { status: "archived" },
      include,
    });
    await logOperation(req, {
      action: "delete_teacher",
      resourceType: "teacher",
      resourceId: teacher.id,
      detail: { name: teacher.name },
    });
    return ok(res, toTeacher(teacher));
  })
);

teachersRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Teacher");
    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: { status: String(req.body.status ?? "active") },
      include,
    });
    await logOperation(req, {
      action: "update_teacher_status",
      resourceType: "teacher",
      resourceId: teacher.id,
      detail: { status: req.body.status },
    });
    return ok(res, toTeacher(teacher));
  })
);
