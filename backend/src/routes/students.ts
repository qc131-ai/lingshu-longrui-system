import { Router } from "express";
import { CreditAdjustType, CreditTransactionStatus, StudentRiskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toStudent, toStudentDetail } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { createStudentSchema, idParamSchema, updateStudentSchema } from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { studentScope } from "../lib/accessScope.js";

export const studentsRouter = Router();

const studentInclude = {
  creditAccount: true,
  advisor: { select: { displayName: true } },
} as const;

function isDatabaseId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

studentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const students = await prisma.student.findMany({
      where: { deletedAt: null, organizationId: _req.user.organizationId, ...studentScope(_req.user) },
      include: studentInclude,
      orderBy: { createdAt: "desc" },
    });
    return ok(res, students.map(toStudent));
  })
);

studentsRouter.post(
  "/",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ body: createStudentSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const initialCredits = Number(input.remainingCredits ?? 0);

    const student = await prisma.$transaction(async (tx) => {
      const createdStudent = await tx.student.create({
        data: {
          name: input.name,
          organizationId: req.user.organizationId,
          phone: input.phone,
          grade: input.grade ?? "10年级",
          school: input.school,
          riskStatus: (toPrismaEnum(input.riskStatus) ?? "NORMAL") as StudentRiskStatus,
          tags: input.tags ?? [],
          enrollmentDate: input.enrollmentDate ?? new Date(),
          targetCountry: input.targetCountry,
          targetDirection: input.targetDirection,
          parentPhone: input.parentPhone,
          notes: input.notes,
          advisorId: req.user.role === "advisor" ? req.user.id : input.advisorId,
        },
      });

      const account = await tx.creditAccount.create({
        data: {
          organizationId: req.user.organizationId,
          studentId: createdStudent.id,
          balance: initialCredits,
          totalPurchased: initialCredits,
        },
      });

      if (initialCredits > 0) {
        await tx.creditTransaction.create({
          data: {
            accountId: account.id,
            organizationId: req.user.organizationId,
            studentId: createdStudent.id,
            adjustType: CreditAdjustType.PURCHASE,
            creditsDelta: initialCredits,
            balanceAfter: initialCredits,
            amount: 0,
            status: CreditTransactionStatus.PAID,
            courseName: "初始购买课时",
            transactionDate: new Date(),
          },
        });
      }

      return tx.student.findUniqueOrThrow({
        where: { id: createdStudent.id },
        include: studentInclude,
      });
    });

    await logOperation(req, {
      action: "create_student",
      resourceType: "student",
      resourceId: student.id,
      detail: { name: student.name, phone: student.phone },
    });

    return created(res, toStudent(student));
  })
);

studentsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (!isDatabaseId(req.params.id)) throw notFound("Student");
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, deletedAt: null, organizationId: req.user.organizationId, ...studentScope(req.user) },
      include: {
        ...studentInclude,
        lessonRecords: {
          orderBy: { lessonDate: "desc" },
          take: 1,
          include: { class: { select: { name: true } } },
        },
      },
    });
    if (!student) throw notFound("Student");
    return ok(res, toStudentDetail(student));
  })
);

studentsRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: updateStudentSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    if (!isDatabaseId(req.params.id)) throw notFound("Student");
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...studentScope(req.user) },
      include: { creditAccount: true },
    });
    if (!existing || existing.deletedAt) throw notFound("Student");

    const updated = await prisma.$transaction(async (tx) => {
      if (input.remainingCredits !== undefined) {
        if (!existing.creditAccount) throw badRequest("Student credit account is missing");
        await tx.creditAccount.update({
          where: { id: existing.creditAccount.id },
          data: { balance: Number(input.remainingCredits), version: { increment: 1 } },
        });
      }

      return tx.student.update({
        where: { id: req.params.id },
        data: {
          name: input.name,
          phone: input.phone,
          grade: input.grade,
          school: input.school,
          riskStatus: input.riskStatus ? (toPrismaEnum(input.riskStatus) as StudentRiskStatus) : undefined,
          tags: input.tags,
          enrollmentDate: input.enrollmentDate,
          targetCountry: input.targetCountry,
          targetDirection: input.targetDirection,
          parentPhone: input.parentPhone,
          notes: input.notes,
        },
        include: studentInclude,
      });
    });

    await logOperation(req, {
      action: "update_student",
      resourceType: "student",
      resourceId: updated.id,
      detail: input,
    });

    return ok(res, toStudent(updated));
  })
);

studentsRouter.delete(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (!isDatabaseId(req.params.id)) throw notFound("Student");
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, deletedAt: null, ...studentScope(req.user) },
    });
    if (!existing) throw notFound("Student");
    const student = await prisma.student.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
      include: studentInclude,
    });
    await logOperation(req, {
      action: "delete_student",
      resourceType: "student",
      resourceId: student.id,
      detail: { name: student.name },
    });
    return ok(res, toStudent(student));
  })
);

studentsRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (!isDatabaseId(req.params.id)) throw notFound("Student");
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...studentScope(req.user) },
    });
    if (!existing) throw notFound("Student");
    const status = String(req.body.status ?? "active").toUpperCase();
    const student = await prisma.student.update({
      where: { id: existing.id },
      data: { status: status as typeof existing.status, deletedAt: status === "ARCHIVED" ? new Date() : null },
      include: studentInclude,
    });
    await logOperation(req, {
      action: "update_student_status",
      resourceType: "student",
      resourceId: student.id,
      detail: { status: req.body.status },
    });
    return ok(res, toStudent(student));
  })
);
