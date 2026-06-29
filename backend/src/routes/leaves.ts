import { Router } from "express";
import { LeaveRequestStatus, LeaveRequestType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { toLeaveRecord } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { createLeaveRecordSchema, idParamSchema, updateLeaveRecordSchema } from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { teacherProfileId } from "../lib/accessScope.js";

export const leavesRouter = Router();

const include = {
  student: { select: { name: true } },
  teacher: { select: { name: true } },
  class: { select: { name: true } },
} as const;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

leavesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownTeacherId = await teacherProfileId(req.user);
    const leaves = await prisma.leaveRecord.findMany({
      where: {
        organizationId: req.user.organizationId,
        teacherId: req.user.role === "teacher" ? ownTeacherId ?? "__no_teacher_profile__" : undefined,
        student: req.user.role === "advisor" ? { advisorId: req.user.id } : undefined,
      },
      include,
      orderBy: { createdAt: "desc" },
    });
    return ok(res, leaves.map(toLeaveRecord));
  })
);

leavesRouter.post(
  "/",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ body: createLeaveRecordSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const leave = await prisma.leaveRecord.create({
      data: {
        organizationId: req.user.organizationId,
        type: toPrismaEnum(input.type) as LeaveRequestType,
        studentId: input.studentId,
        teacherId: input.teacherId,
        classId: input.classId,
        originalDate: dateOnly(input.originalDate),
        makeupDate: input.makeupDate ? dateOnly(input.makeupDate) : undefined,
        reason: input.reason,
        deductCredit: input.deductCredit ?? false,
        status: input.status ? (toPrismaEnum(input.status) as LeaveRequestStatus) : undefined,
        notifyStatus: input.notifyStatus,
      },
      include,
    });
    await logOperation(req, {
      action: "create_leave_record",
      resourceType: "leave_record",
      resourceId: leave.id,
      detail: { classId: leave.classId, studentId: leave.studentId, status: leave.status },
    });
    return created(res, toLeaveRecord(leave));
  })
);

leavesRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const leave = await prisma.leaveRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include,
    });
    if (!leave) throw notFound("Leave record");
    return ok(res, toLeaveRecord(leave));
  })
);

leavesRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: updateLeaveRecordSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.leaveRecord.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Leave record");

    const leave = await prisma.leaveRecord.update({
      where: { id: existing.id },
      data: {
        type: input.type ? (toPrismaEnum(input.type) as LeaveRequestType) : undefined,
        studentId: input.studentId,
        teacherId: input.teacherId,
        classId: input.classId,
        originalDate: input.originalDate ? dateOnly(input.originalDate) : undefined,
        makeupDate: input.makeupDate ? dateOnly(input.makeupDate) : undefined,
        reason: input.reason,
        deductCredit: input.deductCredit,
        status: input.status ? (toPrismaEnum(input.status) as LeaveRequestStatus) : undefined,
        notifyStatus: input.notifyStatus,
      },
      include,
    });
    await logOperation(req, {
      action: "update_leave_record",
      resourceType: "leave_record",
      resourceId: leave.id,
      detail: input,
    });
    return ok(res, toLeaveRecord(leave));
  })
);
