import { Router } from "express";
import {
  CreditAdjustType,
  CreditTransactionStatus,
  LessonAttendance,
  LessonFeedbackStatus,
  LessonStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toLessonRecord, toNumber, toStudent } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  createLessonRecordSchema,
  deductCreditSchema,
  idParamSchema,
  updateLessonRecordSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { lessonScope } from "../lib/accessScope.js";

export const lessonRecordsRouter = Router();

const lessonInclude = {
  student: { select: { name: true } },
  class: { select: { name: true } },
  teacher: { select: { name: true } },
} as const;

lessonRecordsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const records = await prisma.lessonRecord.findMany({
      where: { organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
      include: lessonInclude,
      orderBy: { lessonDate: "desc" },
    });
    return ok(res, records.map(toLessonRecord));
  })
);

lessonRecordsRouter.post(
  "/",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ body: createLessonRecordSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const record = await prisma.lessonRecord.create({
      data: {
        organizationId: req.user.organizationId,
        scheduleId: input.scheduleId,
        classId: input.classId,
        studentId: input.studentId,
        teacherId: input.teacherId,
        lessonDate: new Date(`${input.date}T00:00:00.000Z`),
        topic: input.topic,
        attendance: input.attendance ? (toPrismaEnum(input.attendance) as LessonAttendance) : undefined,
        status: input.status ? (toPrismaEnum(input.status) as LessonStatus) : undefined,
        feedbackStatus: input.feedbackStatus
          ? (toPrismaEnum(input.feedbackStatus) as LessonFeedbackStatus)
          : undefined,
        creditsConsumed: Number(input.creditsConsumed ?? 0),
        performance: input.performance,
        homework: input.homework,
        aiSummary: input.aiSummary,
        needAdvisorFollowUp: input.needAdvisorFollowUp,
        syncToParent: input.syncToParent,
      },
      include: lessonInclude,
    });
    await logOperation(req, {
      action: "create_lesson_record",
      resourceType: "lesson_record",
      resourceId: record.id,
      detail: { studentId: input.studentId, classId: input.classId },
    });
    return created(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ params: idParamSchema, body: updateLessonRecordSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.lessonRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
    });
    if (!existing) throw notFound("Lesson record");
    const record = await prisma.lessonRecord.update({
      where: { id: existing.id },
      data: {
        scheduleId: input.scheduleId,
        classId: input.classId,
        studentId: input.studentId,
        teacherId: input.teacherId,
        lessonDate: input.date ? new Date(`${input.date}T00:00:00.000Z`) : undefined,
        topic: input.topic,
        attendance: input.attendance ? (toPrismaEnum(input.attendance) as LessonAttendance) : undefined,
        status: input.status ? (toPrismaEnum(input.status) as LessonStatus) : undefined,
        feedbackStatus: input.feedbackStatus
          ? (toPrismaEnum(input.feedbackStatus) as LessonFeedbackStatus)
          : undefined,
        creditsConsumed: input.creditsConsumed === undefined ? undefined : Number(input.creditsConsumed),
        performance: input.performance,
        homework: input.homework,
        aiSummary: input.aiSummary,
        needAdvisorFollowUp: input.needAdvisorFollowUp,
        syncToParent: input.syncToParent,
      },
      include: lessonInclude,
    });
    await logOperation(req, {
      action: input.feedbackStatus === "submitted" ? "submit_teacher_feedback" : "save_lesson_draft",
      resourceType: "lesson_record",
      resourceId: record.id,
      detail: input,
    });
    return ok(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.post(
  "/:id/deduct-credit",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ params: idParamSchema, body: deductCreditSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.lessonRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
      include: { student: { include: { creditAccount: true } }, class: true, teacher: true },
    });
    if (!existing) throw notFound("Lesson record");
    if (!existing.student.creditAccount) throw badRequest("Student credit account is missing");
    if (existing.deductedAt) throw badRequest("Lesson record already deducted");

    const credits = toNumber(existing.creditsConsumed);
    if (credits <= 0) throw badRequest("creditsConsumed must be greater than 0");

    const result = await prisma.$transaction(async (tx) => {
      const newBalance = Math.max(0, toNumber(existing.student.creditAccount!.balance) - credits);
      const account = await tx.creditAccount.update({
        where: { id: existing.student.creditAccount!.id },
        data: {
          balance: newBalance,
          totalConsumed: { increment: credits },
          version: { increment: 1 },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          accountId: account.id,
          organizationId: req.user.organizationId,
          studentId: existing.studentId,
          courseId: undefined,
          lessonRecordId: existing.id,
          adjustType: CreditAdjustType.LESSON_DEDUCT,
          creditsDelta: -credits,
          balanceAfter: newBalance,
          amount: 0,
          status: CreditTransactionStatus.PAID,
          courseName: existing.class.name,
          notes: "确认消课自动扣减",
          transactionDate: new Date(),
        },
      });

      const record = await tx.lessonRecord.update({
        where: { id: existing.id },
        data: {
          status: LessonStatus.COMPLETED,
          feedbackStatus: LessonFeedbackStatus.SUBMITTED,
          aiSummary: input.aiSummary ?? existing.aiSummary,
          deductedAt: new Date(),
          deductTransactionId: transaction.id,
        },
        include: lessonInclude,
      });

      const student = await tx.student.findUniqueOrThrow({
        where: { id: existing.studentId },
        include: { creditAccount: true },
      });

      return { student, record };
    });

    await logOperation(req, {
      action: "deduct_credit",
      resourceType: "lesson_record",
      resourceId: result.record.id,
      detail: { studentId: result.student.id, creditsConsumed: credits },
    });

    return ok(res, {
      student: toStudent(result.student),
      record: toLessonRecord(result.record),
    });
  })
);
