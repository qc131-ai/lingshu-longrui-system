import { Router } from "express";
import { Prisma, ScheduleEventType, ScheduleStatus } from "@prisma/client";
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
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, organizationId } });
    if (course) return course;
  }
  if (courseName) return prisma.course.findFirst({ where: { name: courseName, organizationId } });
  return null;
}

async function resolveTeacher(organizationId: string, teacherId?: string, teacher?: string) {
  if (teacherId) {
    const resolvedTeacher = await prisma.teacher.findFirst({ where: { id: teacherId, organizationId } });
    if (resolvedTeacher) return resolvedTeacher;
  }
  if (teacher) return prisma.teacher.findFirst({ where: { name: teacher, organizationId } });
  return null;
}

async function resolveRoom(organizationId: string, roomId?: string, classroom?: string) {
  if (!roomId && !classroom) return null;
  return prisma.room.findFirst({
    where: {
      organizationId,
      OR: [
        roomId ? { id: roomId } : undefined,
        roomId ? { code: roomId } : undefined,
        classroom ? { code: classroom } : undefined,
        classroom ? { label: classroom } : undefined,
      ].filter(Boolean) as Prisma.RoomWhereInput[],
    },
  });
}

function diffHours(startTime: Date, endTime: Date) {
  return (endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000);
}

function resolveDurationHours(input: { duration?: number; consumedHours?: number; startTime: string; endTime?: string }) {
  if (input.duration !== undefined) return Number(input.duration);
  if (input.consumedHours !== undefined) return Number(input.consumedHours);
  if (input.endTime) {
    const duration = diffHours(timeOnly(input.startTime), timeOnly(input.endTime));
    if (duration > 0) return duration;
  }
  throw badRequest("Schedule duration is required");
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
    if (query.classId) where.classId = query.classId as string;
    if (query.courseId) where.courseId = query.courseId as string;
    if (query.status) where.status = toPrismaEnum(query.status as string) as ScheduleStatus;

    const startDate = (query.startDate ?? query.weekStart ?? query.dateFrom) as string | undefined;
    const endDate = (query.endDate ?? query.weekEnd ?? query.dateTo) as string | undefined;
    if (startDate || endDate) {
      where.lessonDate = {
        gte: startDate ? dateOnly(startDate) : undefined,
        lte: endDate ? dateOnly(endDate) : undefined,
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
      resolveRoom(req.user.organizationId, input.roomId, input.classroom),
    ]);

    if (!course) throw badRequest("Course is required");
    if (!teacher) throw badRequest("Teacher is required");
    if (!room) throw badRequest("Room is required");

    const startTime = timeOnly(input.startTime);
    const durationHours = resolveDurationHours(input);
    const endTime = input.endTime ? timeOnly(input.endTime) : addHours(startTime, durationHours);
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
        eventType: input.lessonType ? (toPrismaEnum(input.lessonType) as ScheduleEventType) : ScheduleEventType.CLASS,
        lessonDate,
        startTime,
        durationHours,
        endTime,
        status: input.status ? (toPrismaEnum(input.status) as ScheduleStatus) : ScheduleStatus.SCHEDULED,
        hasConflict: false,
        createdBy: req.user.id,
      },
      include: scheduleInclude,
    });

    await logOperation(req, {
      action: "create_schedule",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: {
        title: schedule.title,
        courseId: course.id,
        teacherId: teacher.id,
        classId: input.classId,
        roomId: room.id,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime ?? `${String(endTime.getUTCHours()).padStart(2, "0")}:${String(endTime.getUTCMinutes()).padStart(2, "0")}`,
        durationHours,
        status: input.status ?? "scheduled",
      },
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
