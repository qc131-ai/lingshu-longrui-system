import { Router } from "express";
import { CourseCategory, CourseStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { toCourse } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { courseQuerySchema, createCourseSchema, idParamSchema, updateCourseSchema } from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";

export const coursesRouter = Router();

coursesRouter.get(
  "/",
  validate({ query: courseQuerySchema }),
  asyncHandler(async (req, res) => {
    const courses = await prisma.course.findMany({
      where: {
        organizationId: req.user.organizationId,
        category: req.query.category ? (toPrismaEnum(req.query.category as string) as CourseCategory) : undefined,
        teachingMethod: (req.query.teachingMode as string | undefined) ?? (req.query.teachingMethod as string | undefined),
        status: req.query.status ? (toPrismaEnum(req.query.status as string) as CourseStatus) : { not: CourseStatus.ARCHIVED },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, courses.map(toCourse));
  })
);

coursesRouter.post(
  "/",
  requireRoles("admin", "academic_manager"),
  validate({ body: createCourseSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const course = await prisma.course.create({
      data: {
        organizationId: req.user.organizationId,
        name: input.name ?? input.courseName,
        category: toPrismaEnum(input.category) as CourseCategory,
        level: input.level,
        totalLessons: input.totalLessons ?? input.totalHours,
        price: input.price,
        description: input.description,
        teachingMethod: input.teachingMethod ?? input.teachingMode,
        targetGrades: input.targetGrades ?? input.suitableGrades,
        responsibleTeacherId: input.responsibleTeacherId,
        syllabus: input.syllabus,
        status: (toPrismaEnum(input.status) ?? "ACTIVE") as CourseStatus,
      },
    });
    await logOperation(req, {
      action: "create_course",
      resourceType: "course",
      resourceId: course.id,
      detail: { name: course.name },
    });
    return created(res, toCourse(course));
  })
);

coursesRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!course) throw notFound("Course");
    return ok(res, toCourse(course));
  })
);

coursesRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateCourseSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Course");
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? input.courseName,
        category: input.category ? (toPrismaEnum(input.category) as CourseCategory) : undefined,
        level: input.level,
        totalLessons: input.totalLessons ?? input.totalHours,
        price: input.price,
        description: input.description,
        teachingMethod: input.teachingMethod ?? input.teachingMode,
        targetGrades: input.targetGrades ?? input.suitableGrades,
        responsibleTeacherId: input.responsibleTeacherId,
        syllabus: input.syllabus,
        status: input.status ? (toPrismaEnum(input.status) as CourseStatus) : undefined,
      },
    });
    await logOperation(req, {
      action: "update_course",
      resourceType: "course",
      resourceId: course.id,
      detail: input,
    });
    return ok(res, toCourse(course));
  })
);

coursesRouter.delete(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Course");
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { status: CourseStatus.ARCHIVED },
    });
    await logOperation(req, {
      action: "delete_course",
      resourceType: "course",
      resourceId: course.id,
      detail: { name: course.name },
    });
    return ok(res, toCourse(course));
  })
);

coursesRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Course");
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { status: toPrismaEnum(req.body.status ?? "active") as CourseStatus },
    });
    await logOperation(req, {
      action: "update_course_status",
      resourceType: "course",
      resourceId: course.id,
      detail: { status: req.body.status },
    });
    return ok(res, toCourse(course));
  })
);
