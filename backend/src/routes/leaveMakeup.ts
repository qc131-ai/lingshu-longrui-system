import { Router, type Request } from "express";
import { CreditAdjustType, CreditTransactionStatus, LeaveRequestStatus, LeaveRequestType, Prisma, ScheduleEventType, ScheduleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { toNumber, toSchedule } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { requireRoles } from "../middleware/auth.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { teacherProfileId } from "../lib/accessScope.js";
import {
  approveLeaveMakeupSchema,
  createLeaveMakeupSchema,
  idParamSchema,
  leaveMakeupQuerySchema,
  notifyParentSchema,
  rejectLeaveMakeupSchema,
  scheduleMakeupSchema,
  updateLeaveMakeupSchema,
  updateLeaveMakeupStatusSchema,
} from "../validators/schemas.js";

export const leaveMakeupRouter = Router();

const include = {
  schedule: { include: { course: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } }, student: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, room: { select: { label: true, code: true } } } },
  lessonRecord: { select: { id: true, deductionStatus: true, deductedAt: true, deductTransactionId: true } },
  student: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true } },
  makeupSchedule: { include: { course: { select: { id: true, name: true } }, teacher: { select: { name: true } }, student: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, room: { select: { label: true, code: true } }, lessonRecords: { select: { id: true }, take: 1 } } },
  creator: { select: { displayName: true } },
  approver: { select: { displayName: true } },
} satisfies Prisma.LeaveMakeupRequestInclude;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeOnly(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

function formatTime(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
  return trimmed;
}

async function safeLogOperation(req: Parameters<typeof logOperation>[0], input: Parameters<typeof logOperation>[1]) {
  try {
    await logOperation(req, input);
  } catch (error) {
    console.warn(`Operation log failed for ${input.action}:`, error);
  }
}

function toApiRequest(record: Prisma.LeaveMakeupRequestGetPayload<{ include: typeof include }>) {
  return {
    id: record.id,
    scheduleId: record.scheduleId,
    lessonRecordId: record.lessonRecordId ?? undefined,
    studentId: record.studentId ?? undefined,
    studentName: record.student?.name ?? record.schedule.student?.name ?? "",
    classId: record.classId ?? undefined,
    className: record.class?.name ?? record.schedule.class?.name ?? "",
    courseId: record.courseId,
    courseName: record.course.name,
    teacherId: record.teacherId,
    teacherName: record.teacher.name,
    requestType: record.requestType.toLowerCase(),
    type: record.requestType.toLowerCase(),
    originalDate: record.originalDate.toISOString().slice(0, 10),
    originalStartTime: formatTime(record.originalStartTime),
    originalEndTime: formatTime(record.originalEndTime),
    originalTime: `${formatTime(record.originalStartTime)} - ${formatTime(record.originalEndTime)}`,
    newDate: record.newDate?.toISOString().slice(0, 10),
    newStartTime: record.newStartTime ? formatTime(record.newStartTime) : undefined,
    newEndTime: record.newEndTime ? formatTime(record.newEndTime) : undefined,
    makeupDate: record.newDate?.toISOString().slice(0, 10),
    reason: record.reason,
    deductCredit: record.deductCredit,
    needMakeup: record.needMakeup,
    status: record.status.toLowerCase(),
    approvalNote: record.approvalNote ?? undefined,
    rejectReason: record.rejectReason ?? undefined,
    parentNotified: record.parentNotified,
    notifyStatus: record.parentNotified ? "notified" : "pending",
    makeupScheduleId: record.makeupScheduleId ?? undefined,
    makeupSchedule: record.makeupSchedule ? toSchedule(record.makeupSchedule) : undefined,
    createdBy: record.creator?.displayName ?? "",
    approvedBy: record.approver?.displayName ?? "",
    approvedAt: record.approvedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function scopedWhere(req: Request): Promise<Prisma.LeaveMakeupRequestWhereInput> {
  const where: Prisma.LeaveMakeupRequestWhereInput = { organizationId: req.user.organizationId };
  if (req.user.role === "teacher") {
    const teacherId = await teacherProfileId(req.user);
    where.teacherId = teacherId ?? "__no_teacher_profile__";
  }
  if (req.user.role === "advisor") {
    where.student = { advisorId: req.user.id };
  }
  return where;
}

async function assertCanCreate(req: Request, schedule: Prisma.ScheduleGetPayload<{ include: { student: true } }>, requestType: string) {
  if (req.user.role === "finance") throw badRequest("财务无请假补课操作权限");
  if (req.user.role === "teacher") {
    const teacherId = await teacherProfileId(req.user);
    if (requestType !== "teacher_leave" || teacherId !== schedule.teacherId) throw badRequest("老师只能提交自己的老师请假申请");
  }
  if (req.user.role === "advisor") {
    if (!schedule.studentId || schedule.student?.advisorId !== req.user.id) throw badRequest("顾问只能为自己负责学员提交申请");
  }
}

async function findConflict(input: {
  organizationId: string;
  lessonDate: Date;
  startTime: Date;
  endTime: Date;
  teacherId: string;
  studentId?: string | null;
  classId?: string | null;
  classroom?: string | null;
}) {
  return prisma.schedule.findFirst({
    where: {
      organizationId: input.organizationId,
      status: { not: ScheduleStatus.CANCELLED },
      lessonDate: input.lessonDate,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
      OR: [
        { teacherId: input.teacherId },
        ...(input.studentId ? [{ studentId: input.studentId }] : []),
        ...(input.classId ? [{ classId: input.classId }] : []),
        ...(input.classroom ? [{ classroom: input.classroom }] : []),
      ],
    },
    select: { id: true },
  });
}

async function applyLeaveDeduction(req: Request, record: Prisma.LeaveMakeupRequestGetPayload<{ include: typeof include }>) {
  if (!record.deductCredit || !record.studentId) return null;
  if (record.lessonRecord?.deductedAt || record.lessonRecord?.deductTransactionId) return null;
  const account = await prisma.creditAccount.findFirst({
    where: { organizationId: req.user.organizationId, studentId: record.studentId, courseId: record.courseId, status: "active" },
  });
  if (!account) throw badRequest("未找到该学生课程的课时账户");
  const consumedHours = toNumber(record.schedule.durationHours);
  if (consumedHours <= 0) throw badRequest("原排课课时必须大于 0");
  const balanceBefore = toNumber(account.balance);
  if (req.user.role !== "admin" && consumedHours > balanceBefore) throw badRequest("本次扣减课时不能超过剩余课时");
  const balanceAfter = balanceBefore - consumedHours;
  const updated = await prisma.$transaction(async (tx) => {
    const creditAccount = await tx.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: balanceAfter,
        totalConsumed: { increment: consumedHours },
        lowBalance: balanceAfter <= 5,
        version: { increment: 1 },
      },
    });
    const creditTransaction = await tx.creditTransaction.create({
      data: {
        accountId: account.id,
        organizationId: req.user.organizationId,
        studentId: record.studentId!,
        courseId: record.courseId,
        adjustType: CreditAdjustType.LEAVE_DEDUCTION,
        creditsDelta: -consumedHours,
        balanceBefore,
        balanceAfter,
        amount: 0,
        status: CreditTransactionStatus.PAID,
        courseName: record.course.name,
        notes: `请假补课申请扣课时：${record.reason}`,
        transactionDate: new Date(),
        createdBy: req.user.id,
      },
    });
    return { creditAccount, creditTransaction };
  });
  await safeLogOperation(req, {
    action: "create_credit_transaction",
    resourceType: "credit_transaction",
    resourceId: updated.creditTransaction.id,
    detail: { transactionType: "leave_deduction", leaveMakeupRequestId: record.id, hoursChange: -consumedHours, balanceBefore, balanceAfter },
  });
  return updated;
}

leaveMakeupRouter.get(
  "/",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ query: leaveMakeupQuerySchema }),
  asyncHandler(async (req, res) => {
    const where: Prisma.LeaveMakeupRequestWhereInput = await scopedWhere(req);
    const query = req.query;
    where.studentId = cleanString(query.studentId);
    where.teacherId = cleanString(query.teacherId);
    where.courseId = cleanString(query.courseId);
    where.classId = cleanString(query.classId);
    const requestType = cleanString(query.requestType);
    const status = cleanString(query.status);
    if (requestType) where.requestType = toPrismaEnum(requestType) as LeaveRequestType;
    if (status) where.status = toPrismaEnum(status) as LeaveRequestStatus;
    const startDate = cleanString(query.startDate);
    const endDate = cleanString(query.endDate);
    if (startDate || endDate) {
      where.originalDate = {
        gte: startDate ? dateOnly(startDate) : undefined,
        lte: endDate ? dateOnly(endDate) : undefined,
      };
    }
    const records = await prisma.leaveMakeupRequest.findMany({ where, include, orderBy: { createdAt: "desc" } });
    return ok(res, records.map(toApiRequest));
  })
);

leaveMakeupRouter.post(
  "/",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ body: createLeaveMakeupSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const schedule = await prisma.schedule.findFirst({
      where: { id: input.scheduleId, organizationId: req.user.organizationId },
      include: { student: true },
    });
    if (!schedule) throw notFound("Schedule");
    await assertCanCreate(req, schedule, input.requestType);
    const requestType = toPrismaEnum(input.requestType) as LeaveRequestType;
    const needMakeup = input.needMakeup ?? input.requestType !== "cancellation";
    const deductCredit = input.deductCredit ?? false;
    const record = await prisma.leaveMakeupRequest.create({
      data: {
        organizationId: req.user.organizationId,
        scheduleId: schedule.id,
        lessonRecordId: input.lessonRecordId,
        studentId: schedule.studentId,
        classId: schedule.classId,
        courseId: schedule.courseId,
        teacherId: schedule.teacherId,
        requestType,
        originalDate: schedule.lessonDate,
        originalStartTime: schedule.startTime,
        originalEndTime: schedule.endTime,
        newDate: input.newDate ? dateOnly(input.newDate) : undefined,
        newStartTime: input.newStartTime ? timeOnly(input.newStartTime) : undefined,
        newEndTime: input.newEndTime ? timeOnly(input.newEndTime) : undefined,
        reason: input.reason,
        deductCredit,
        needMakeup,
        status: LeaveRequestStatus.PENDING,
        createdBy: req.user.id,
      },
      include,
    });
    await safeLogOperation(req, { action: "create_leave_makeup_request", resourceType: "leave_makeup_request", resourceId: record.id, detail: { requestType: input.requestType, deductCredit, needMakeup } });
    return created(res, toApiRequest(record));
  })
);

leaveMakeupRouter.get(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const record = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, ...(await scopedWhere(req)) }, include });
    if (!record) throw notFound("Leave makeup request");
    return ok(res, toApiRequest(record));
  })
);

leaveMakeupRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ params: idParamSchema, body: updateLeaveMakeupSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, ...(await scopedWhere(req)) } });
    if (!existing) throw notFound("Leave makeup request");
    if (input.status && req.user.role !== "admin" && req.user.role !== "academic_manager") {
      throw new AppError(403, "FORBIDDEN", "当前账号无权更新审批状态");
    }
    const nextDeductCredit = input.deductCredit ?? existing.deductCredit;
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: {
        requestType: input.requestType ? (toPrismaEnum(input.requestType) as LeaveRequestType) : undefined,
        lessonRecordId: input.lessonRecordId === null ? null : input.lessonRecordId,
        reason: input.reason,
        deductCredit: input.deductCredit,
        needMakeup: input.needMakeup,
        newDate: input.newDate === null ? null : input.newDate ? dateOnly(input.newDate) : undefined,
        newStartTime: input.newStartTime === null ? null : input.newStartTime ? timeOnly(input.newStartTime) : undefined,
        newEndTime: input.newEndTime === null ? null : input.newEndTime ? timeOnly(input.newEndTime) : undefined,
        status: input.status ? (toPrismaEnum(input.status) as LeaveRequestStatus) : undefined,
      },
      include,
    });
    await safeLogOperation(req, { action: "update_leave_makeup_request", resourceType: "leave_makeup_request", resourceId: record.id, detail: input });
    if (nextDeductCredit !== existing.deductCredit) {
      await safeLogOperation(req, { action: "update_leave_makeup_deduct_credit", resourceType: "leave_makeup_request", resourceId: record.id, detail: { from: existing.deductCredit, to: nextDeductCredit } });
    }
    return ok(res, toApiRequest(record));
  })
);

leaveMakeupRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateLeaveMakeupStatusSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    if (input.status === "rejected" && !input.rejectReason) throw badRequest("拒绝申请必须填写拒绝原因");
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) throw notFound("Leave makeup request");
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: {
        status: toPrismaEnum(input.status) as LeaveRequestStatus,
        approvalNote: input.approvalNote,
        rejectReason: input.rejectReason,
        approvedBy: ["approved", "makeup_pending", "makeup_scheduled", "completed", "parent_notified"].includes(input.status) ? req.user.id : undefined,
        approvedAt: ["approved", "makeup_pending", "makeup_scheduled", "completed", "parent_notified"].includes(input.status) ? new Date() : undefined,
      },
      include,
    });
    await safeLogOperation(req, { action: "update_leave_makeup_status", resourceType: "leave_makeup_request", resourceId: record.id, detail: input });
    return ok(res, toApiRequest(record));
  })
);

leaveMakeupRouter.post(
  "/:id/approve",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: approveLeaveMakeupSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId }, include });
    if (!existing) throw notFound("Leave makeup request");
    const status = existing.needMakeup ? LeaveRequestStatus.MAKEUP_PENDING : LeaveRequestStatus.APPROVED;
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: { status, approvalNote: req.body.approvalNote, approvedBy: req.user.id, approvedAt: new Date() },
      include,
    });
    if (record.requestType === LeaveRequestType.CANCELLATION || !record.needMakeup) {
      await prisma.schedule.update({ where: { id: record.scheduleId }, data: { status: ScheduleStatus.CANCELLED, cancelReason: record.reason, cancelledAt: new Date() } });
    }
    if (record.needMakeup) {
      await prisma.schedule.update({ where: { id: record.scheduleId }, data: { status: ScheduleStatus.MAKEUP_PENDING } });
    }
    await applyLeaveDeduction(req, record);
    await safeLogOperation(req, { action: "approve_leave_makeup_request", resourceType: "leave_makeup_request", resourceId: record.id, detail: { status: status.toLowerCase(), deductCredit: record.deductCredit } });
    return ok(res, toApiRequest(record));
  })
);

leaveMakeupRouter.post(
  "/:id/reject",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: rejectLeaveMakeupSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) throw notFound("Leave makeup request");
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: { status: LeaveRequestStatus.REJECTED, rejectReason: req.body.rejectReason, approvedBy: req.user.id, approvedAt: new Date() },
      include,
    });
    await safeLogOperation(req, { action: "reject_leave_makeup_request", resourceType: "leave_makeup_request", resourceId: record.id, detail: { rejectReason: req.body.rejectReason } });
    return ok(res, toApiRequest(record));
  })
);

leaveMakeupRouter.post(
  "/:id/schedule-makeup",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: scheduleMakeupSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId }, include });
    if (!existing) throw notFound("Leave makeup request");
    const lessonDate = dateOnly(input.date);
    const startTime = timeOnly(input.startTime);
    const endTime = timeOnly(input.endTime);
    const teacherId = input.teacherId ?? existing.teacherId;
    const conflict = await findConflict({ organizationId: req.user.organizationId, lessonDate, startTime, endTime, teacherId, studentId: existing.studentId, classId: existing.classId, classroom: input.classroom });
    if (conflict) throw badRequest(`补课时间冲突：${conflict.id}`);
    const schedule = await prisma.schedule.create({
      data: {
        organizationId: req.user.organizationId,
        courseId: existing.courseId,
        teacherId,
        studentId: existing.studentId,
        classId: existing.classId,
        title: existing.course.name,
        eventType: input.lessonType ? (toPrismaEnum(input.lessonType) as ScheduleEventType) : ScheduleEventType.CLASS,
        lessonDate,
        startTime,
        endTime,
        durationHours: (endTime.getTime() - startTime.getTime()) / 3600000,
        classroom: input.classroom,
        status: ScheduleStatus.SCHEDULED,
        notes: input.notes ?? `补课安排，来源申请 ${existing.id}`,
        createdBy: req.user.id,
      },
    });
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: { status: LeaveRequestStatus.MAKEUP_SCHEDULED, makeupScheduleId: schedule.id, newDate: lessonDate, newStartTime: startTime, newEndTime: endTime },
      include,
    });
    await prisma.schedule.update({ where: { id: existing.scheduleId }, data: { status: ScheduleStatus.MAKEUP_PENDING } });
    await safeLogOperation(req, { action: "schedule_makeup", resourceType: "leave_makeup_request", resourceId: record.id, detail: { makeupScheduleId: schedule.id } });
    await safeLogOperation(req, { action: "create_makeup_schedule", resourceType: "schedule", resourceId: schedule.id, detail: { leaveMakeupRequestId: record.id } });
    return created(res, { request: toApiRequest(record), schedule: toSchedule(await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id }, include: { course: { select: { id: true, name: true } }, teacher: { select: { name: true } }, student: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, room: { select: { label: true, code: true } }, creator: { select: { displayName: true } }, lessonRecords: { select: { id: true }, take: 1 } } })) });
  })
);

leaveMakeupRouter.post(
  "/:id/notify-parent",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: notifyParentSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.leaveMakeupRequest.findFirst({ where: { id: req.params.id, ...(await scopedWhere(req)) } });
    if (!existing) throw notFound("Leave makeup request");
    const record = await prisma.leaveMakeupRequest.update({
      where: { id: existing.id },
      data: { parentNotified: true, status: LeaveRequestStatus.PARENT_NOTIFIED },
      include,
    });
    await safeLogOperation(req, { action: "notify_leave_makeup_parent", resourceType: "leave_makeup_request", resourceId: record.id, detail: { message: req.body.message ?? "" } });
    return ok(res, toApiRequest(record));
  })
);
