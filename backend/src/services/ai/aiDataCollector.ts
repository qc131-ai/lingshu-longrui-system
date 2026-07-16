import { prisma } from "../../lib/prisma.js";
import type { MockUser } from "../../middleware/auth.js";

type CollectorContext = {
  user: MockUser;
  teacherId: string | null;
};

export async function collectAiAgentData(ctx: CollectorContext) {
  const organization = await prisma.organization.findUnique({
    where: { id: ctx.user.organizationId },
    select: { id: true, name: true, code: true },
  });
  const advisorScope = ctx.user.role === "advisor" ? { advisorId: ctx.user.id } : {};
  const teacherLessonScope = ctx.user.role === "teacher" && ctx.teacherId ? { teacherId: ctx.teacherId } : {};
  const teacherNoScope = ctx.user.role === "teacher" && !ctx.teacherId ? { id: "__no_teacher_profile__" } : {};

  const [studentCount, lowCreditAccounts, pendingLeaveMakeupCount, pendingReportCount, missingFeedbackRecords] = await Promise.all([
    prisma.student.count({
      where: { organizationId: ctx.user.organizationId, deletedAt: null, ...advisorScope },
    }),
    prisma.creditAccount.findMany({
      where: {
        organizationId: ctx.user.organizationId,
        status: "active",
        balance: { lte: 5 },
        ...(ctx.user.role === "advisor" ? { student: { advisorId: ctx.user.id } } : {}),
      },
      select: {
        studentId: true,
        courseId: true,
        balance: true,
        student: { select: { name: true, advisor: { select: { displayName: true } } } },
        course: { select: { name: true } },
      },
      orderBy: [{ balance: "asc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    ctx.user.role === "finance"
      ? Promise.resolve(0)
      : prisma.leaveMakeupRequest.count({
          where: {
            organizationId: ctx.user.organizationId,
            status: { in: ["PENDING", "MAKEUP_PENDING"] },
            ...(ctx.user.role === "advisor" ? { student: { advisorId: ctx.user.id } } : {}),
            ...(ctx.user.role === "teacher" ? (ctx.teacherId ? { teacherId: ctx.teacherId } : { id: "__no_teacher_profile__" }) : {}),
          },
        }),
    ctx.user.role === "finance" || ctx.user.role === "teacher"
      ? Promise.resolve(0)
      : prisma.parentReport.count({
          where: {
            organizationId: ctx.user.organizationId,
            status: { in: ["DRAFT", "GENERATED", "REVIEWED"] },
            ...(ctx.user.role === "advisor" ? { student: { advisorId: ctx.user.id } } : {}),
          },
        }),
    ctx.user.role === "finance"
      ? Promise.resolve([])
      : prisma.lessonRecord.findMany({
          where: {
            organizationId: ctx.user.organizationId,
            status: { in: ["DRAFT", "PENDING_FEEDBACK"] },
            ...teacherLessonScope,
            ...teacherNoScope,
            ...(ctx.user.role === "advisor" ? { student: { advisorId: ctx.user.id } } : {}),
          },
          select: {
            teacherId: true,
            teacher: { select: { name: true } },
            course: { select: { name: true } },
            lessonDate: true,
          },
          orderBy: { lessonDate: "desc" },
          take: 50,
        }),
  ]);

  const feedbackByTeacher = new Map<string, { teacherName: string; count: number; courses: Set<string> }>();
  for (const record of missingFeedbackRecords) {
    const item = feedbackByTeacher.get(record.teacherId) ?? { teacherName: record.teacher.name, count: 0, courses: new Set<string>() };
    item.count += 1;
    if (record.course?.name) item.courses.add(record.course.name);
    feedbackByTeacher.set(record.teacherId, item);
  }

  return {
    organization: organization ?? { id: ctx.user.organizationId, name: "当前机构", code: "" },
    summary: {
      currentUserRole: ctx.user.role,
      organizationName: organization?.name ?? "当前机构",
      studentCount,
      lowCreditStudents: lowCreditAccounts.map((account) => ({
        studentId: account.studentId,
        courseId: account.courseId,
        studentName: account.student.name,
        courseName: account.course?.name ?? "未绑定课程",
        remainingHours: Number(account.balance),
        advisorName: account.student.advisor?.displayName ?? "未分配",
      })),
      pendingLeaveMakeupCount,
      pendingParentReportCount: pendingReportCount,
      missingFeedbackTeachers: Array.from(feedbackByTeacher.values()).map((item) => ({
        teacherName: item.teacherName,
        missingCount: item.count,
        courses: Array.from(item.courses).slice(0, 5),
      })),
    },
  };
}
