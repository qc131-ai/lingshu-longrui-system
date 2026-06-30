import { Router } from "express";
import { Prisma, ScheduleEventType, ScheduleStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { toSchedule } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  createScheduleSchema,
  idParamSchema,
  scheduleQuerySchema,
  updateScheduleStatusSchema,
  updateScheduleSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { scheduleScope } from "../lib/accessScope.js";

export const schedulesRouter = Router();

const scheduleInclude = {
  course: { select: { id: true, name: true } },
  teacher: { select: { name: true } },
  student: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  room: { select: { label: true, code: true } },
  creator: { select: { displayName: true } },
  lessonRecords: { select: { id: true }, take: 1 },
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

function isUuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

async function resolveStudent(organizationId: string, studentId?: string) {
  if (!studentId) return null;
  return prisma.student.findFirst({ where: { id: studentId, organizationId } });
}

async function resolveRoom(organizationId: string, roomId?: string) {
  if (!roomId) return null;
  if (!isUuid(roomId)) {
    console.warn(`Ignoring non-UUID roomId for schedule creation: ${roomId}`);
    return null;
  }
  return prisma.room.findFirst({
    where: {
      organizationId,
      id: roomId,
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

function resolveScheduleTimes(input: {
  startTime: string;
  endTime?: string;
  duration?: number;
  consumedHours?: number;
}) {
  const startTime = timeOnly(input.startTime);
  const durationHours = resolveDurationHours(input);
  const endTime = input.endTime ? timeOnly(input.endTime) : addHours(startTime, durationHours);
  return { startTime, endTime, durationHours };
}

function overlaps(startTime: Date, endTime: Date, item: { startTime: Date; endTime: Date }) {
  return startTime < item.endTime && item.startTime < endTime;
}

function toConflict(type: string, scheduleId: string) {
  return conflict("排课时间冲突", {
    conflictType: type,
    conflictScheduleId: scheduleId,
  });
}

async function detectConflict(input: {
  lessonDate: Date;
  startTime: Date;
  endTime: Date;
  teacherId: string;
  studentId?: string | null;
  classId?: string | null;
  roomId?: string | null;
  classroom?: string | null;
  organizationId: string;
  excludeId?: string;
}) {
  const conflictTargets: Prisma.ScheduleWhereInput[] = [{ teacherId: input.teacherId }];
  if (input.studentId) {
    conflictTargets.push(
      { studentId: input.studentId },
      { lessonRecords: { some: { studentId: input.studentId } } },
      { class: { enrollments: { some: { studentId: input.studentId, status: "active" } } } }
    );
  }
  if (input.classId) conflictTargets.push({ classId: input.classId });
  if (input.roomId) conflictTargets.push({ roomId: input.roomId });
  if (input.classroom) conflictTargets.push({ classroom: input.classroom });

  const conflicts = await prisma.schedule.findMany({
    where: {
      id: input.excludeId ? { not: input.excludeId } : undefined,
      organizationId: input.organizationId,
      lessonDate: input.lessonDate,
      status: { not: ScheduleStatus.CANCELLED },
      OR: conflictTargets,
    },
  });

  const overlapped = conflicts.filter((item) => overlaps(input.startTime, input.endTime, item));
  const teacherConflict = overlapped.find((item) => item.teacherId === input.teacherId);
  if (teacherConflict) return { conflictType: "teacher", conflictScheduleId: teacherConflict.id };
  const studentConflict = overlapped.find((item) => input.studentId && item.studentId === input.studentId);
  if (input.studentId && studentConflict) return { conflictType: "student", conflictScheduleId: studentConflict.id };
  const classConflict = overlapped.find((item) => input.classId && item.classId === input.classId);
  if (classConflict) return { conflictType: "class", conflictScheduleId: classConflict.id };
  const roomConflict = overlapped.find(
    (item) => (input.roomId && item.roomId === input.roomId) || (input.classroom && item.classroom === input.classroom)
  );
  if (roomConflict) return { conflictType: "classroom", conflictScheduleId: roomConflict.id };
  return null;
}

schedulesRouter.get(
  "/",
  validate({ query: scheduleQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query;
    const where: Prisma.ScheduleWhereInput = {};
    where.organizationId = req.user.organizationId;
    Object.assign(where, await scheduleScope(req.user));

    const teacherId = cleanString(query.teacherId);
    const studentId = cleanString(query.studentId);
    const classId = cleanString(query.classId);
    const courseId = cleanString(query.courseId);
    const status = cleanString(query.status);

    if (teacherId) where.teacherId = teacherId;
    if (classId) where.classId = classId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = toPrismaEnum(status) as ScheduleStatus;

    const startDate = cleanString(query.startDate) ?? cleanString(query.weekStart) ?? cleanString(query.dateFrom);
    const endDate = cleanString(query.endDate) ?? cleanString(query.weekEnd) ?? cleanString(query.dateTo);
    if (startDate || endDate) {
      where.lessonDate = {
        gte: startDate ? dateOnly(startDate) : undefined,
        lte: endDate ? dateOnly(endDate) : undefined,
      };
    }
    if (studentId) {
      where.OR = [
        { studentId },
        { lessonRecords: { some: { studentId } } },
        { class: { enrollments: { some: { studentId, status: "active" } } } },
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
    const [course, teacher, student, room] = await Promise.all([
      resolveCourse(req.user.organizationId, input.courseId, input.courseName),
      resolveTeacher(req.user.organizationId, input.teacherId, input.teacher),
      resolveStudent(req.user.organizationId, input.studentId),
      resolveRoom(req.user.organizationId, input.roomId),
    ]);

    if (!course) throw badRequest("Course is required");
    if (!teacher) throw badRequest("Teacher is required");

    const { startTime, endTime, durationHours } = resolveScheduleTimes(input);
    const lessonDate = dateOnly(input.date);
    const scheduleConflict = await detectConflict({
      lessonDate,
      startTime,
      endTime,
      teacherId: teacher.id,
      studentId: student?.id,
      classId: input.classId,
      roomId: room?.id,
      classroom: input.classroom,
      organizationId: req.user.organizationId,
    });
    if (scheduleConflict) throw toConflict(scheduleConflict.conflictType, scheduleConflict.conflictScheduleId);

    const schedule = await prisma.schedule.create({
      data: {
        courseId: course.id,
        organizationId: req.user.organizationId,
        teacherId: teacher.id,
        studentId: student?.id,
        classId: input.classId,
        roomId: room?.id,
        classroom: input.classroom,
        title: course.name,
        eventType: input.lessonType ? (toPrismaEnum(input.lessonType) as ScheduleEventType) : ScheduleEventType.CLASS,
        lessonDate,
        startTime,
        durationHours,
        endTime,
        status: input.status ? (toPrismaEnum(input.status) as ScheduleStatus) : ScheduleStatus.SCHEDULED,
        hasConflict: false,
        notes: input.notes,
        createdBy: req.user.id,
      },
      include: scheduleInclude,
    });

    await safeLogOperation(req, {
      action: "create_schedule",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: {
        title: schedule.title,
        courseId: course.id,
        teacherId: teacher.id,
        studentId: student?.id,
        classId: input.classId,
        roomId: room?.id,
        classroom: input.classroom,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime ?? `${String(endTime.getUTCHours()).padStart(2, "0")}:${String(endTime.getUTCMinutes()).padStart(2, "0")}`,
        durationHours,
        status: input.status ?? "scheduled",
        notes: input.notes,
      },
    });

    return created(res, { event: toSchedule(schedule), hasConflict: false });
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
    const resolvedRoomId = isUuid(input.roomId) ? input.roomId : undefined;
    if (input.roomId && !resolvedRoomId) {
      console.warn(`Ignoring non-UUID roomId for schedule update: ${input.roomId}`);
    }
    if (input.date || input.startTime || input.endTime || input.duration || input.teacherId || input.studentId || input.classId || input.roomId || input.classroom) {
      startTime = input.startTime ? timeOnly(input.startTime) : existing.startTime;
      endTime = input.endTime ? timeOnly(input.endTime) : input.duration === undefined ? existing.endTime : addHours(startTime, Number(input.duration));
      lessonDate = input.date ? dateOnly(input.date) : existing.lessonDate;
      const scheduleConflict = await detectConflict({
        lessonDate,
        startTime,
        endTime,
        teacherId: input.teacherId ?? existing.teacherId,
        studentId: input.studentId ?? existing.studentId,
        classId: input.classId ?? existing.classId,
        roomId: resolvedRoomId ?? existing.roomId,
        classroom: input.classroom ?? existing.classroom,
        organizationId: req.user.organizationId,
        excludeId: existing.id,
      });
      if (scheduleConflict) throw toConflict(scheduleConflict.conflictType, scheduleConflict.conflictScheduleId);
      hasConflict = false;
    }

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        courseId: input.courseId,
        teacherId: input.teacherId,
        studentId: input.studentId,
        classId: input.classId,
        roomId: resolvedRoomId,
        classroom: input.classroom,
        lessonDate,
        startTime,
        endTime,
        durationHours: input.duration === undefined && !input.endTime ? undefined : diffHours(startTime ?? existing.startTime, endTime ?? existing.endTime),
        hasConflict,
        status: input.status ? (toPrismaEnum(input.status) as ScheduleStatus) : undefined,
        notes: input.notes,
        cancelReason: input.cancelReason,
        cancelledAt: input.status === "cancelled" ? new Date() : undefined,
      },
      include: scheduleInclude,
    });

    await safeLogOperation(req, {
      action: input.status === "cancelled" ? "cancel_schedule" : "update_schedule",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: input,
    });

    return ok(res, toSchedule(schedule));
  })
);

schedulesRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateScheduleStatusSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const existing = await prisma.schedule.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Schedule");

    const status = toPrismaEnum(input.status) as ScheduleStatus;
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        status,
        notes: input.notes,
        cancelReason: input.cancelReason,
        cancelledAt: input.status === "cancelled" ? new Date() : undefined,
      },
      include: scheduleInclude,
    });

    await safeLogOperation(req, {
      action: input.status === "cancelled" ? "cancel_schedule" : "update_schedule_status",
      resourceType: "schedule",
      resourceId: schedule.id,
      detail: input,
    });

    return ok(res, toSchedule(schedule));
  })
);
