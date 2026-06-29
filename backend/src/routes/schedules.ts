import { Router } from "express";
import { Prisma, ScheduleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toSchedule } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  createScheduleSchema,
  idParamSchema,
  scheduleQuerySchema,
  updateScheduleSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { scheduleScope } from "../lib/accessScope.js";

export const schedulesRouter = Router();

const scheduleInclude = {
  course: { select: { name: true } },
  teacher: { select: { name: true } },
  room: { select: { label: true, code: true } },
} as const;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeOnly(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

function addHours(time: Date, hours: number) {
  return new Date(time.getTime() + hours * 60 * 60 * 1000);
}

async function resolveCourse(organizationId: string, courseId?: string, courseName?: string) {
  if (courseId) return prisma.course.findFirst({ where: { id: courseId, organizationId } });
  if (courseName) return prisma.course.findFirst({ where: { name: courseName, organizationId } });
  return null;
}

async function resolveTeacher(organizationId: string, teacherId?: string, teacher?: string) {
  if (teacherId) return prisma.teacher.findFirst({ where: { id: teacherId, organizationId } });
  if (teacher) return prisma.teacher.findFirst({ where: { name: teacher, organizationId } });
  return null;
}

async function resolveRoom(organizationId: string, roomId?: string) {
  if (!roomId) return null;
  return prisma.room.findFirst({ where: { organizationId, OR: [{ id: roomId }, { code: roomId }] } });
}

async function detectConflict(input: {
  lessonDate: Date;
  startTime: Date;
  endTime: Date;
  teacherId: string;
  roomId: string;
  organizationId: string;
  excludeId?: string;
}) {
  const conflicts = await prisma.schedule.findMany({
    where: {
      id: input.excludeId ? { not: input.excludeId } : undefined,
      organizationId: input.organizationId,
      lessonDate: input.lessonDate,
      status: { not: ScheduleStatus.CANCELLED },
      OR: [{ teacherId: input.teacherId }, { roomId: input.roomId }],
    },
  });

  return conflicts.some(
    (item) =>
      input.startTime < item.endTime &&
      item.startTime < input.endTime
  );
}

schedulesRouter.get(
  "/",
  validate({ query: scheduleQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query;
    const where: Prisma.ScheduleWhereInput = {};
    where.organizationId = req.user.organizationId;
    Object.assign(where, await scheduleScope(req.user));

    if (query.teacherId) where.teacherId = query.teacherId as string;
    if (query.dateFrom || query.dateTo) {
      where.lessonDate = {
        gte: query.dateFrom ? dateOnly(query.dateFrom as string) : undefined,
        lte: query.dateTo ? dateOnly(query.dateTo as string) : undefined,
      };
    }
    if (query.studentId) {
      where.OR = [
        { lessonRecords: { some: { studentId: query.studentId as string } } },
        { class: { enrollments: { some: { studentId: query.studentId as string, status: "active" } } } },
      ];
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: scheduleInclude,
      orderBy: [{ lessonDate: "asc" }, { startTime: "asc" }],
    });
    return ok(res, schedules.map(toSchedule));
  })
);

schedulesRouter.post(
  "/",
  requireRoles("admin", "academic_manager"),
  validate({ body: createScheduleSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const [course, teacher, room] = await Promise.all([
      resolveCourse(req.user.organizationId, input.courseId, input.courseName),
      resolveTeacher(req.user.organizationId, input.teacherId, input.teacher),
      resolveRoom(req.user.organizationId, input.roomId),
    ]);

    if (!course) throw badRequest("Course is required");
    if (!teacher) throw badRequest("Teacher is required");
    if (!room) throw badRequest("Room is required");

    const startTime = timeOnly(input.startTime);
    const endTime = addHours(startTime, Number(input.duration));
    const lessonDate = dateOnly(input.date);
    const hasConflict = await detectConflict({
      lessonDate,
      startTime,
      endTime,
      teacherId: teacher.id,
      roomId: room.id,
      organizationId: req.user.organizationId,
    });
    if (hasConflict) throw badRequest("Schedule conflict detected");

    const schedule = await prisma.schedule.create({
      data: {
        courseId: course.id,
        organizationId: req.user.organizationId,
        teacherId: teacher.id,
        classId: input.classId,
        roomId: room.id,
        title: course.name,
        lessonDate,
        startTime,
        durationHours: Number(input.duration),
        endTime,
        hasConflict: false,
      },
      include: scheduleInclude,
    });

    await logOperation(req, {
      action: "create_schedule",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: { title: schedule.title, date: input.date, startTime: input.startTime },
    });

    return created(res, { event: toSchedule(schedule), hasConflict });
  })
);

schedulesRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateScheduleSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.schedule.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Schedule");

    let startTime: Date | undefined;
    let endTime: Date | undefined;
    let lessonDate: Date | undefined;
    let hasConflict: boolean | undefined;
    if (input.date || input.startTime || input.duration || input.teacherId || input.roomId) {
      startTime = input.startTime ? timeOnly(input.startTime) : existing.startTime;
      const duration = input.duration === undefined ? Number(existing.durationHours) : Number(input.duration);
      endTime = addHours(startTime, duration);
      lessonDate = input.date ? dateOnly(input.date) : existing.lessonDate;
      hasConflict = await detectConflict({
        lessonDate,
        startTime,
        endTime,
        teacherId: input.teacherId ?? existing.teacherId,
        roomId: input.roomId ?? existing.roomId,
        organizationId: req.user.organizationId,
        excludeId: existing.id,
      });
      if (hasConflict) throw badRequest("Schedule conflict detected");
    }

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        courseId: input.courseId,
        teacherId: input.teacherId,
        classId: input.classId,
        roomId: input.roomId,
        lessonDate,
        startTime,
        endTime,
        durationHours: input.duration === undefined ? undefined : Number(input.duration),
        hasConflict,
        status: input.status ? (toPrismaEnum(input.status) as ScheduleStatus) : undefined,
        cancelReason: input.cancelReason,
        cancelledAt: input.status === "cancelled" ? new Date() : undefined,
      },
      include: scheduleInclude,
    });

    await logOperation(req, {
      action: input.status === "cancelled" ? "cancel_schedule" : "update_schedule",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: input,
    });

    return ok(res, toSchedule(schedule));
  })
);
