import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { MockUser } from "../middleware/auth.js";

export function studentScope(user: MockUser): Prisma.StudentWhereInput {
  if (user.role === "advisor") return { advisorId: user.id };
  return {};
}

export async function teacherProfileId(user: MockUser) {
  if (user.role !== "teacher") return null;
  const teacher = await prisma.teacher.findFirst({
    where: { organizationId: user.organizationId, userId: user.id },
    select: { id: true },
  });
  return teacher?.id ?? null;
}

export async function scheduleScope(user: MockUser): Promise<Prisma.ScheduleWhereInput> {
  if (user.role === "teacher") {
    const teacherId = await teacherProfileId(user);
    return teacherId ? { teacherId } : { id: "__no_teacher_profile__" };
  }
  return {};
}

export async function lessonScope(user: MockUser): Promise<Prisma.LessonRecordWhereInput> {
  if (user.role === "teacher") {
    const teacherId = await teacherProfileId(user);
    return teacherId ? { teacherId } : { id: "__no_teacher_profile__" };
  }
  if (user.role === "advisor") {
    return { student: { advisorId: user.id } };
  }
  return {};
}

export function reportScope(user: MockUser): Prisma.ParentReportWhereInput {
  if (user.role === "advisor") return { student: { advisorId: user.id } };
  return {};
}
