import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toClass } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { addClassStudentSchema, createClassSchema, idParamSchema, updateClassSchema } from "../validators/schemas.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";

export const classesRouter = Router();

const include = {
  course: { select: { name: true } },
  teacher: { select: { name: true } },
  enrollments: { include: { student: { select: { name: true } } } },
} as const;

classesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const classes = await prisma.class.findMany({
      where: { organizationId: req.user.organizationId },
      include,
      orderBy: { createdAt: "desc" },
    });
    return ok(res, classes.map(toClass));
  })
);

classesRouter.post(
  "/",
  requireRoles("admin", "academic_manager"),
  validate({ body: createClassSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const [course, teacher] = await Promise.all([
      prisma.course.findFirst({ where: { id: input.courseId, organizationId: req.user.organizationId } }),
      prisma.teacher.findFirst({ where: { id: input.teacherId, organizationId: req.user.organizationId } }),
    ]);
    if (!course) throw badRequest("Course is required");
    if (!teacher) throw badRequest("Teacher is required");
    const studentIds = input.studentIds ?? [];
    if (studentIds.length > input.capacity) throw badRequest("Class capacity exceeded");

    const item = await prisma.$transaction(async (tx) => {
      const newClass = await tx.class.create({
        data: {
          organizationId: req.user.organizationId,
          name: input.name,
          courseId: input.courseId,
          teacherId: input.teacherId,
          scheduleDesc: input.scheduleDesc,
          capacity: input.capacity,
          enrolledCount: studentIds.length || (input.enrolledCount ?? 0),
          classroom: input.classroom,
          status: input.status ?? "active",
        },
      });
      if (studentIds.length) {
        await tx.classEnrollment.createMany({
          data: studentIds.map((studentId: string) => ({
            organizationId: req.user.organizationId,
            classId: newClass.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }
      return tx.class.findUniqueOrThrow({ where: { id: newClass.id }, include });
    });

    await logOperation(req, {
      action: "create_class",
      resourceType: "class",
      resourceId: item.id,
      detail: { name: item.name, courseId: item.courseId, teacherId: item.teacherId },
    });
    return created(res, toClass(item));
  })
);

classesRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const item = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include,
    });
    if (!item) throw notFound("Class");
    return ok(res, toClass(item));
  })
);

classesRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateClassSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Class");
    if (input.studentIds && input.capacity !== undefined && input.studentIds.length > input.capacity) {
      throw badRequest("Class capacity exceeded");
    }

    const item = await prisma.$transaction(async (tx) => {
      if (input.studentIds) {
        const capacity = input.capacity ?? existing.capacity;
        if (input.studentIds.length > capacity) throw badRequest("Class capacity exceeded");
        await tx.classEnrollment.deleteMany({ where: { classId: existing.id } });
        await tx.classEnrollment.createMany({
          data: input.studentIds.map((studentId: string) => ({
            organizationId: req.user.organizationId,
            classId: existing.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }
      return tx.class.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          courseId: input.courseId,
          teacherId: input.teacherId,
          scheduleDesc: input.scheduleDesc,
          capacity: input.capacity,
          enrolledCount: input.studentIds ? input.studentIds.length : input.enrolledCount,
          classroom: input.classroom,
          status: input.status,
        },
        include,
      });
    });

    await logOperation(req, {
      action: "update_class",
      resourceType: "class",
      resourceId: item.id,
      detail: input,
    });
    return ok(res, toClass(item));
  })
);

classesRouter.delete(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Class");
    const item = await prisma.class.update({
      where: { id: existing.id },
      data: { status: "archived" },
      include,
    });
    await logOperation(req, {
      action: "delete_class",
      resourceType: "class",
      resourceId: item.id,
      detail: { name: item.name },
    });
    return ok(res, toClass(item));
  })
);

classesRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Class");
    const item = await prisma.class.update({
      where: { id: existing.id },
      data: { status: String(req.body.status ?? "active") },
      include,
    });
    await logOperation(req, {
      action: "update_class_status",
      resourceType: "class",
      resourceId: item.id,
      detail: { status: req.body.status },
    });
    return ok(res, toClass(item));
  })
);

classesRouter.post(
  "/:id/students",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: addClassStudentSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { enrollments: true },
    });
    if (!existing) throw notFound("Class");
    if (existing.enrollments.length >= existing.capacity) throw badRequest("Class capacity exceeded");
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, organizationId: req.user.organizationId, deletedAt: null },
    });
    if (!student) throw notFound("Student");
    await prisma.classEnrollment.create({
      data: {
        organizationId: req.user.organizationId,
        classId: existing.id,
        studentId: student.id,
      },
    });
    const item = await prisma.class.update({
      where: { id: existing.id },
      data: { enrolledCount: { increment: 1 } },
      include,
    });
    await logOperation(req, {
      action: "add_class_student",
      resourceType: "class",
      resourceId: item.id,
      detail: { studentId: student.id },
    });
    return ok(res, toClass(item));
  })
);

classesRouter.delete(
  "/:id/students/:studentId",
  requireRoles("admin", "academic_manager"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Class");
    await prisma.classEnrollment.deleteMany({
      where: { classId: existing.id, studentId: req.params.studentId, organizationId: req.user.organizationId },
    });
    const count = await prisma.classEnrollment.count({ where: { classId: existing.id } });
    const item = await prisma.class.update({
      where: { id: existing.id },
      data: { enrolledCount: count },
      include,
    });
    await logOperation(req, {
      action: "remove_class_student",
      resourceType: "class",
      resourceId: item.id,
      detail: { studentId: req.params.studentId },
    });
    return ok(res, toClass(item));
  })
);
