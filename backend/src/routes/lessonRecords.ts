import { Router } from "express";
import {
  CreditAdjustType,
  CreditTransactionStatus,
  LessonDeductionStatus,
  LessonAttendance,
  LessonFeedbackStatus,
  LessonStatus,
  Prisma,
  ScheduleStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toCreditTransaction, toLessonRecord, toNumber, toStudent } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  createLessonRecordSchema,
  confirmDeductionSchema,
  deductCreditSchema,
  idParamSchema,
  lessonRecordQuerySchema,
  updateLessonRecordSchema,
  updateLessonRecordStatusSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { lessonScope } from "../lib/accessScope.js";

export const lessonRecordsRouter = Router();

const lessonInclude = {
  student: { select: { name: true } },
  class: { select: { name: true } },
  course: { select: { name: true } },
  teacher: { select: { name: true } },
} as const;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeOnly(value?: string) {
  if (!value) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
  return trimmed;
}

async function safeLogOperation(
  req: Parameters<typeof logOperation>[0],
  input: Parameters<typeof logOperation>[1]
) {
  try {
    await logOperation(req, input);
  } catch (error) {
    console.warn(`Operation log failed for ${input.action}:`, error);
  }
}

function lessonRecordData(input: {
  scheduleId?: string;
  courseId?: string;
  classId?: string | null;
  studentId?: string | null;
  teacherId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  classroom?: string;
  duration?: number;
  topic?: string;
  attendance?: string;
  status?: string;
  feedbackStatus?: string;
  creditsConsumed?: number;
  performance?: string;
  knowledgeMastery?: string;
  homework?: string;
  nextPlan?: string;
  internalNotes?: string;
  aiSummary?: string;
  needAdvisorFollowUp?: boolean;
  syncToParent?: boolean;
}) {
  return {
    scheduleId: input.scheduleId,
    courseId: input.courseId,
    classId: input.classId,
    studentId: input.studentId,
    teacherId: input.teacherId,
    lessonDate: input.date ? dateOnly(input.date) : undefined,
    startTime: timeOnly(input.startTime),
    endTime: timeOnly(input.endTime),
    classroom: input.classroom,
    durationHours: input.duration === undefined ? undefined : Number(input.duration),
    topic: input.topic,
    attendance: input.attendance ? (toPrismaEnum(input.attendance) as LessonAttendance) : undefined,
    status: input.status ? (toPrismaEnum(input.status) as LessonStatus) : undefined,
    feedbackStatus: input.feedbackStatus
      ? (toPrismaEnum(input.feedbackStatus) as LessonFeedbackStatus)
      : undefined,
    creditsConsumed: input.creditsConsumed === undefined ? undefined : Number(input.creditsConsumed),
    performance: input.performance,
    knowledgeMastery: input.knowledgeMastery,
    homework: input.homework,
    nextPlan: input.nextPlan,
    internalNotes: input.internalNotes,
    aiSummary: input.aiSummary,
    needAdvisorFollowUp: input.needAdvisorFollowUp,
    syncToParent: input.syncToParent,
  };
}

lessonRecordsRouter.get(
  "/",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ query: lessonRecordQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query;
    const where: Prisma.LessonRecordWhereInput = {
      organizationId: req.user.organizationId,
      ...(await lessonScope(req.user)),
    };
    const startDate = cleanString(query.startDate);
    const endDate = cleanString(query.endDate);
    if (startDate || endDate) {
      where.lessonDate = {
        gte: startDate ? dateOnly(startDate) : undefined,
        lte: endDate ? dateOnly(endDate) : undefined,
      };
    }
    const teacherId = cleanString(query.teacherId);
    const courseId = cleanString(query.courseId);
    const status = cleanString(query.status);
    const search = cleanString(query.search);
    if (teacherId) where.teacherId = teacherId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = toPrismaEnum(status) as LessonStatus;
    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: "insensitive" } } },
        { class: { name: { contains: search, mode: "insensitive" } } },
        { course: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const records = await prisma.lessonRecord.findMany({
      where,
      include: lessonInclude,
      orderBy: { lessonDate: "desc" },
    });
    return ok(res, records.map(toLessonRecord));
  })
);

lessonRecordsRouter.get(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const record = await prisma.lessonRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
      include: lessonInclude,
    });
    if (!record) throw notFound("Lesson record");
    return ok(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.post(
  "/from-schedule/:id",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        lessonRecords: { include: lessonInclude },
        course: { select: { name: true } },
        room: { select: { label: true, code: true } },
      },
    });
    if (!schedule) throw notFound("Schedule");
    if (req.user.role === "teacher") {
      const scope = await lessonScope(req.user);
      if ("teacherId" in scope && scope.teacherId !== schedule.teacherId) throw notFound("Schedule");
    }
    const existing = schedule.lessonRecords[0];
    if (existing) return ok(res, toLessonRecord(existing));

    const record = await prisma.lessonRecord.create({
      data: {
        organizationId: req.user.organizationId,
        scheduleId: schedule.id,
        courseId: schedule.courseId,
        classId: schedule.classId,
        studentId: schedule.studentId,
        teacherId: schedule.teacherId,
        lessonDate: schedule.lessonDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        classroom: schedule.classroom ?? schedule.room?.label ?? schedule.room?.code,
        durationHours: schedule.durationHours,
        status: LessonStatus.PENDING_FEEDBACK,
        feedbackStatus: LessonFeedbackStatus.PENDING,
        creditsConsumed: 0,
      },
      include: lessonInclude,
    });

    await safeLogOperation(req, {
      action: "create_lesson_record_from_schedule",
      resourceType: "lesson_record",
      resourceId: record.id,
      detail: { scheduleId: schedule.id, studentId: schedule.studentId, classId: schedule.classId, courseId: schedule.courseId },
    });
    return created(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.post(
  "/",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ body: createLessonRecordSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    if (!input.teacherId) throw badRequest("Teacher is required");
    const record = await prisma.lessonRecord.create({
      data: {
        organizationId: req.user.organizationId,
        ...lessonRecordData(input),
        teacherId: input.teacherId as string,
        lessonDate: dateOnly(input.date),
        status: input.status ? (toPrismaEnum(input.status) as LessonStatus) : LessonStatus.DRAFT,
        creditsConsumed: Number(input.creditsConsumed ?? 0),
      },
      include: lessonInclude,
    });
    await safeLogOperation(req, {
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
      data: lessonRecordData(input),
      include: lessonInclude,
    });
    await safeLogOperation(req, {
      action: input.status === "submitted" || input.feedbackStatus === "submitted" ? "submit_teacher_feedback" : "save_lesson_draft",
      resourceType: "lesson_record",
      resourceId: record.id,
      detail: input,
    });
    return ok(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager", "teacher"),
  validate({ params: idParamSchema, body: updateLessonRecordStatusSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.lessonRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
    });
    if (!existing) throw notFound("Lesson record");
    const status = toPrismaEnum(input.status) as LessonStatus;
    const record = await prisma.lessonRecord.update({
      where: { id: existing.id },
      data: {
        status,
        feedbackStatus: input.status === "submitted" ? LessonFeedbackStatus.SUBMITTED : undefined,
        aiSummary: input.aiSummary,
      },
      include: lessonInclude,
    });
    if (input.status === "submitted" && record.scheduleId) {
      await prisma.schedule.update({
        where: { id: record.scheduleId },
        data: { status: ScheduleStatus.COMPLETED },
      });
    }
    await safeLogOperation(req, {
      action: input.status === "submitted" ? "submit_teacher_feedback" : "update_lesson_record_status",
      resourceType: "lesson_record",
      resourceId: record.id,
      detail: input,
    });
    return ok(res, toLessonRecord(record));
  })
);

lessonRecordsRouter.post(
  "/:id/confirm-deduction",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: confirmDeductionSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.lessonRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await lessonScope(req.user)) },
      include: { student: true, class: true, course: true, teacher: true, deductTransaction: true },
    });
    if (!existing) throw notFound("Lesson record");
    if (existing.status !== LessonStatus.SUBMITTED && existing.status !== LessonStatus.COMPLETED) {
      throw badRequest("只有已提交反馈或已完成的上课记录可以确认消课");
    }
    if (existing.deductionStatus === LessonDeductionStatus.DEDUCTED || existing.deductedAt || existing.deductTransactionId) {
      throw badRequest("该上课记录已完成消课");
    }
    if (!existing.studentId) throw badRequest("上课记录未关联学员，无法确认消课");
    if (!existing.courseId) throw badRequest("上课记录未关联课程，无法确认消课");

    const consumedHours = Number(input.consumedHours);
    if (consumedHours <= 0) throw badRequest("consumedHours must be greater than 0");

    const account = await prisma.creditAccount.findFirst({
      where: {
        organizationId: req.user.organizationId,
        studentId: existing.studentId,
        courseId: existing.courseId,
        status: "active",
      },
      include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
    });
    if (!account) throw badRequest("未找到该学生课程的课时账户");

    const balanceBefore = toNumber(account.balance);
    const allowOverdraft = req.user.role === "admin";
    if (!allowOverdraft && consumedHours > balanceBefore) {
      throw badRequest("本次扣减课时不能超过剩余课时");
    }
    const balanceAfter = balanceBefore - consumedHours;
    const lowBalance = balanceAfter <= 5;

    const result = await prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          totalConsumed: { increment: consumedHours },
          lowBalance,
          version: { increment: 1 },
        },
        include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          accountId: updatedAccount.id,
          organizationId: req.user.organizationId,
          studentId: existing.studentId!,
          courseId: existing.courseId,
          lessonRecordId: existing.id,
          adjustType: CreditAdjustType.LESSON_DEDUCT,
          creditsDelta: -consumedHours,
          balanceBefore,
          balanceAfter,
          amount: 0,
          status: CreditTransactionStatus.PAID,
          courseName: existing.course?.name ?? existing.class?.name ?? "确认消课",
          notes: input.deductionNote ?? "确认消课自动扣减",
          transactionDate: new Date(),
          createdBy: req.user.id,
        },
        include: { student: { select: { name: true } }, course: { select: { name: true } } },
      });

      const lessonRecord = await tx.lessonRecord.update({
        where: { id: existing.id },
        data: {
          status: LessonStatus.COMPLETED,
          feedbackStatus: LessonFeedbackStatus.SUBMITTED,
          creditsConsumed: consumedHours,
          syncToParent: input.syncToParent,
          deductionStatus: LessonDeductionStatus.DEDUCTED,
          deductedAt: new Date(),
          deductTransactionId: transaction.id,
        },
        include: lessonInclude,
      });

      return { lessonRecord, creditAccount: updatedAccount, creditTransaction: transaction };
    });

    await safeLogOperation(req, {
      action: "confirm_lesson_deduction",
      resourceType: "lesson_record",
      resourceId: result.lessonRecord.id,
      detail: { consumedHours, balanceBefore, balanceAfter, transactionId: result.creditTransaction.id },
    });
    await safeLogOperation(req, {
      action: "create_credit_transaction",
      resourceType: "credit_transaction",
      resourceId: result.creditTransaction.id,
      detail: { transactionType: "lesson_deduction", hoursChange: -consumedHours },
    });
    if (lowBalance) {
      await safeLogOperation(req, {
        action: "low_balance_warning",
        resourceType: "credit_account",
        resourceId: result.creditAccount.id,
        detail: { remainingHours: balanceAfter, threshold: 5 },
      });
    }

    return ok(res, {
      lessonRecord: toLessonRecord(result.lessonRecord),
      creditAccount: {
        id: result.creditAccount.id,
        studentId: result.creditAccount.studentId,
        courseId: result.creditAccount.courseId,
        remainingHours: toNumber(result.creditAccount.balance),
        totalConsumedHours: toNumber(result.creditAccount.totalConsumed),
        lowBalance: result.creditAccount.lowBalance || toNumber(result.creditAccount.balance) <= 5,
        status: result.creditAccount.status,
      },
      creditTransaction: toCreditTransaction(result.creditTransaction),
    });
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
      include: { student: { include: { creditAccounts: true } }, class: true, teacher: true },
    });
    if (!existing) throw notFound("Lesson record");
    if (!existing.studentId || !existing.student) throw badRequest("Student is required for credit deduction");
    const studentAccount = existing.student.creditAccounts.find((account) => account.courseId === existing.courseId) ?? existing.student.creditAccounts[0];
    if (!studentAccount) throw badRequest("Student credit account is missing");
    if (existing.deductedAt) throw badRequest("Lesson record already deducted");
    const student = existing.student;
    const studentId = existing.studentId;

    const credits = toNumber(existing.creditsConsumed);
    if (credits <= 0) throw badRequest("creditsConsumed must be greater than 0");

    const result = await prisma.$transaction(async (tx) => {
      const newBalance = Math.max(0, toNumber(studentAccount.balance) - credits);
      const account = await tx.creditAccount.update({
        where: { id: studentAccount.id },
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
          studentId,
          courseId: undefined,
          lessonRecordId: existing.id,
          adjustType: CreditAdjustType.LESSON_DEDUCT,
          creditsDelta: -credits,
          balanceAfter: newBalance,
          amount: 0,
          status: CreditTransactionStatus.PAID,
          courseName: existing.class?.name ?? "确认消课",
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

      const resultStudent = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        include: { creditAccounts: true },
      });

      return { student: resultStudent, record };
    });

    await safeLogOperation(req, {
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
