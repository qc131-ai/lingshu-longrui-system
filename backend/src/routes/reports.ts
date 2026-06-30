import { Router, type Request } from "express";
import { ParentReportStatus, ParentReportType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { toNumber, toParentReport } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  generateReportSchema,
  idParamSchema,
  reportQuerySchema,
  sendReportSchema,
  updateReportSchema,
  updateReportStatusSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { teacherProfileId } from "../lib/accessScope.js";

export const reportsRouter = Router();

const reportInclude = {
  course: { select: { name: true } },
  advisor: { select: { displayName: true } },
  sender: { select: { displayName: true } },
} satisfies Prisma.ParentReportInclude;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function defaultPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start, end };
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
  return trimmed;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function safeLogOperation(req: Parameters<typeof logOperation>[0], input: Parameters<typeof logOperation>[1]) {
  try {
    await logOperation(req, input);
  } catch (error) {
    console.warn(`Operation log failed for ${input.action}:`, error);
  }
}

async function reportScope(req: Request): Promise<Prisma.ParentReportWhereInput> {
  if (req.user.role === "advisor") return { student: { advisorId: req.user.id } };
  if (req.user.role === "teacher") {
    const teacherId = await teacherProfileId(req.user);
    return teacherId ? { student: { lessonRecords: { some: { teacherId } } } } : { id: "__no_report_scope__" };
  }
  return {};
}

function ensureCanEdit(req: Request, status: ParentReportStatus) {
  if (req.user.role === "teacher" || req.user.role === "finance") {
    throw new AppError(403, "FORBIDDEN", "当前账号无权编辑家长报告");
  }
  if (status === ParentReportStatus.SENT && req.user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "已发送报告仅管理员可编辑");
  }
  const editableStatuses: ParentReportStatus[] = [
    ParentReportStatus.DRAFT,
    ParentReportStatus.GENERATED,
    ParentReportStatus.REVIEWED,
    ParentReportStatus.SENT,
  ];
  if (!editableStatuses.includes(status)) {
    throw badRequest("当前报告状态不可编辑");
  }
}

reportsRouter.get(
  "/",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ query: reportQuerySchema }),
  asyncHandler(async (req, res) => {
    const where: Prisma.ParentReportWhereInput = {
      organizationId: req.user.organizationId,
      ...(await reportScope(req)),
    };
    const studentId = cleanString(req.query.studentId);
    const courseId = cleanString(req.query.courseId);
    const advisorId = cleanString(req.query.advisorId);
    const reportType = cleanString(req.query.reportType);
    const status = cleanString(req.query.status);
    if (studentId) where.studentId = studentId;
    if (courseId) where.courseId = courseId;
    if (advisorId) where.advisorId = advisorId;
    if (reportType) where.reportType = toPrismaEnum(reportType) as ParentReportType;
    if (status) where.status = toPrismaEnum(status) as ParentReportStatus;
    const startDate = cleanString(req.query.startDate);
    const endDate = cleanString(req.query.endDate);
    if (startDate || endDate) {
      where.periodStart = { gte: startDate ? dateOnly(startDate) : undefined };
      where.periodEnd = { lte: endDate ? dateOnly(endDate) : undefined };
    }

    const reports = await prisma.parentReport.findMany({
      where,
      include: reportInclude,
      orderBy: { createdAt: "desc" },
    });
    return ok(res, reports.map(toParentReport));
  })
);

reportsRouter.get(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor", "teacher"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await reportScope(req)) },
      include: reportInclude,
    });
    if (!report) throw notFound("Parent report");
    return ok(res, toParentReport(report));
  })
);

reportsRouter.post(
  "/generate",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ body: generateReportSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const period = defaultPeriod();
    const periodStart = input.reportPeriodStart || input.periodStart ? dateOnly(input.reportPeriodStart ?? input.periodStart) : period.start;
    const periodEnd = input.reportPeriodEnd || input.periodEnd ? dateOnly(input.reportPeriodEnd ?? input.periodEnd) : period.end;
    const includeLessons = input.includeLessons ?? true;
    const includeCredits = input.includeCredits ?? true;
    const includeLeaveMakeup = input.includeLeaveMakeup ?? true;
    const includeHomework = input.includeHomework ?? true;
    const includeAiSummary = input.includeAiSummary ?? true;

    const student = await prisma.student.findFirst({
      where: { id: input.studentId, organizationId: req.user.organizationId },
      include: { advisor: { select: { id: true, displayName: true } } },
    });
    if (!student) throw notFound("Student");
    if (req.user.role === "advisor" && student.advisorId !== req.user.id) throw notFound("Student");

    const courseFilter = input.courseId ? { courseId: input.courseId } : {};
    const [course, records, creditAccounts, transactions, leaveRequests] = await Promise.all([
      input.courseId
        ? prisma.course.findFirst({ where: { id: input.courseId, organizationId: req.user.organizationId }, select: { id: true, name: true } })
        : Promise.resolve(null),
      prisma.lessonRecord.findMany({
        where: {
          organizationId: req.user.organizationId,
          studentId: student.id,
          lessonDate: { gte: periodStart, lte: periodEnd },
          ...courseFilter,
        },
        include: { course: { select: { name: true } }, teacher: { select: { name: true } } },
        orderBy: { lessonDate: "asc" },
      }),
      prisma.creditAccount.findMany({
        where: { organizationId: req.user.organizationId, studentId: student.id, ...(input.courseId ? { courseId: input.courseId } : {}) },
        include: { course: { select: { name: true } } },
      }),
      prisma.creditTransaction.findMany({
        where: {
          organizationId: req.user.organizationId,
          studentId: student.id,
          transactionDate: { gte: periodStart, lte: periodEnd },
          ...(input.courseId ? { courseId: input.courseId } : {}),
        },
      }),
      prisma.leaveMakeupRequest.findMany({
        where: {
          organizationId: req.user.organizationId,
          studentId: student.id,
          originalDate: { gte: periodStart, lte: periodEnd },
          ...(input.courseId ? { courseId: input.courseId } : {}),
        },
      }),
    ]);
    if (input.courseId && !course) throw notFound("Course");

    const completedRecords = records.filter((record) => record.status === "COMPLETED" || record.status === "SUBMITTED");
    const lessonCount = records.length;
    const totalHours = records.reduce((sum, record) => sum + toNumber(record.durationHours), 0);
    const homeworkCount = records.filter((record) => Boolean(record.homework)).length;
    const presentCount = records.filter((record) => record.attendance === "PRESENT").length;
    const attendanceRate = lessonCount ? round((presentCount / lessonCount) * 100) : 100;
    const homeworkRate = lessonCount ? round((homeworkCount / lessonCount) * 100) : 100;
    const courses = [...new Set(records.map((record) => record.course?.name).filter(Boolean))];
    const courseNames = course?.name ? [course.name] : courses;
    const purchasedHours = creditAccounts.reduce((sum, account) => sum + toNumber(account.totalPurchased), 0);
    const consumedHours = creditAccounts.reduce((sum, account) => sum + toNumber(account.totalConsumed), 0);
    const remainingHours = creditAccounts.reduce((sum, account) => sum + toNumber(account.balance), 0);
    const periodConsumed = Math.abs(transactions.filter((item) => toNumber(item.creditsDelta) < 0).reduce((sum, item) => sum + toNumber(item.creditsDelta), 0));
    const lowBalance = creditAccounts.some((account) => account.lowBalance || toNumber(account.balance) <= 5);
    const leaveCount = leaveRequests.filter((item) => item.requestType === "STUDENT_LEAVE" || item.requestType === "TEACHER_LEAVE").length;
    const rescheduleCount = leaveRequests.filter((item) => item.requestType === "RESCHEDULE").length;
    const makeupCount = leaveRequests.filter((item) => item.status === "MAKEUP_SCHEDULED" || item.status === "COMPLETED").length;
    const notifiedCount = leaveRequests.filter((item) => item.parentNotified).length;
    const feedbackLines = records.map((record) => record.performance || record.aiSummary).filter(Boolean).slice(0, 5);
    const homeworkLines = records.map((record) => record.homework).filter(Boolean).slice(0, 5);
    const aiLines = records.map((record) => record.aiSummary).filter(Boolean).slice(0, 3);

    const lessonSummary = includeLessons
      ? `本周期共完成 ${lessonCount} 次课程，累计 ${round(totalHours)} 小时。${completedRecords.length ? `其中 ${completedRecords.length} 次已完成反馈闭环。` : "暂无已完成反馈记录。"}`
      : "本报告未包含上课记录明细。";
    const teacherFeedbackSummary = feedbackLines.length ? feedbackLines.join("；") : "老师反馈显示，学生本阶段学习节奏整体稳定。";
    const homeworkSummary = includeHomework
      ? (homeworkLines.length ? homeworkLines.join("；") : "本周期暂无明确作业布置记录。")
      : "本报告未包含作业数据。";
    const attendanceSummary = `本周期出勤率 ${attendanceRate}%，请假/调课记录 ${leaveRequests.length} 条。`;
    const creditSummary = includeCredits
      ? `累计购买 ${round(purchasedHours)} 小时，累计消耗 ${round(consumedHours)} 小时，当前剩余 ${round(remainingHours)} 小时，本周期消耗 ${round(periodConsumed)} 小时。${lowBalance ? "当前已触发低课时提醒，请关注续课安排。" : "课时余额处于正常范围。"}`
      : "本报告未包含课时数据。";
    const leaveMakeupSummary = includeLeaveMakeup
      ? `本周期请假 ${leaveCount} 次，调课 ${rescheduleCount} 次，补课安排 ${makeupCount} 次，已通知家长 ${notifiedCount} 次。`
      : "本报告未包含请假补课数据。";
    const weaknessAnalysis = records.some((record) => record.knowledgeMastery)
      ? records.map((record) => record.knowledgeMastery).filter(Boolean).slice(0, 3).join("；")
      : "建议继续关注错题复盘、课堂输出和课后作业完成质量。";
    const nextStepPlan = records.some((record) => record.nextPlan)
      ? records.map((record) => record.nextPlan).filter(Boolean).slice(0, 3).join("；")
      : "下阶段建议保持稳定上课节奏，围绕薄弱知识点进行专项练习，并按周复盘学习成果。";
    const summary = `${student.name}本周期学习整体平稳，${lessonSummary}`;
    const aiSummary = includeAiSummary
      ? `${student.name}家长您好，本阶段孩子共完成 ${lessonCount} 次课程，累计 ${round(totalHours)} 小时。课堂反馈显示学习状态持续推进，建议接下来重点关注作业质量与薄弱点复盘。`
      : "";
    const parentVisibleContent = [summary, teacherFeedbackSummary, homeworkSummary, creditSummary, leaveMakeupSummary, nextStepPlan]
      .filter(Boolean)
      .join("\n\n");

    const report = await prisma.parentReport.create({
      data: {
        organizationId: req.user.organizationId,
        studentId: student.id,
        courseId: input.courseId,
        advisorId: student.advisorId,
        reportType: input.reportType ? (toPrismaEnum(input.reportType) as ParentReportType) : ParentReportType.MONTHLY,
        title: `${student.name}${course?.name ? ` - ${course.name}` : ""}学习报告`,
        summary,
        courseProgress: courseNames.length ? `本周期关联课程：${courseNames.join("、")}` : "本周期暂无明确课程记录。",
        lessonSummary,
        teacherFeedbackSummary,
        homeworkSummary,
        attendanceSummary,
        creditSummary,
        leaveMakeupSummary,
        weaknessAnalysis,
        nextStepPlan,
        aiSummary,
        internalNotes: "系统自动生成草稿，发送前请教务复核。",
        parentVisibleContent,
        periodLabel: `${periodStart.toISOString().slice(0, 10)} 至 ${periodEnd.toISOString().slice(0, 10)}`,
        periodStart,
        periodEnd,
        studentName: student.name,
        grade: student.grade,
        coursesSummary: courseNames.join("、") || "暂无课程",
        monthlyHours: round(totalHours),
        attendanceRate,
        homeworkRate,
        scoreImprovement: Number(student.recentTestScore ?? 0),
        courseRecords: records.map((record) => ({
          date: record.lessonDate.toISOString().slice(0, 10),
          course: record.course?.name ?? "课程",
          topic: record.topic ?? "",
          teacher: record.teacher.name,
          feedback: record.performance ?? record.aiSummary ?? "",
        })),
        trendData: [
          { name: "上阶段", score: Math.max(60, Number(student.recentTestScore ?? 82) - 5) },
          { name: "当前", score: Number(student.recentTestScore ?? 86) },
        ],
        radarData: [
          { subject: "课堂参与", A: Math.max(70, Math.round(attendanceRate)), fullMark: 100 },
          { subject: "作业完成", A: Math.max(60, Math.round(homeworkRate)), fullMark: 100 },
          { subject: "知识掌握", A: Number(student.recentTestScore ?? 84), fullMark: 100 },
        ],
        status: ParentReportStatus.GENERATED,
        generatedAt: new Date(),
        createdBy: req.user.id,
      },
      include: reportInclude,
    });

    if (includeAiSummary) {
      await prisma.aiTask.create({
        data: {
          taskType: "PARENT_REPORT_SUMMARY",
          organizationId: req.user.organizationId,
          status: "COMPLETED",
          studentId: student.id,
          parentReportId: report.id,
          inputPayload: { studentId: student.id, courseId: input.courseId, periodStart, periodEnd },
          outputPayload: { summary: aiSummary },
          completedAt: new Date(),
        },
      });
    }

    await safeLogOperation(req, {
      action: "generate_parent_report",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { studentId: student.id, courseId: input.courseId, reportType: report.reportType.toLowerCase(), periodStart, periodEnd },
    });

    return created(res, toParentReport(report));
  })
);

reportsRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: updateReportSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...(await reportScope(req)) },
    });
    if (!existing) throw notFound("Parent report");
    ensureCanEdit(req, existing.status);
    const report = await prisma.parentReport.update({
      where: { id: existing.id },
      data: req.body,
      include: reportInclude,
    });
    await safeLogOperation(req, {
      action: "update_parent_report",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { fields: Object.keys(req.body) },
    });
    return ok(res, toParentReport(report));
  })
);

reportsRouter.patch(
  "/:id/status",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: updateReportStatusSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Parent report");
    const status = toPrismaEnum(req.body.status) as ParentReportStatus;
    const report = await prisma.parentReport.update({
      where: { id: existing.id },
      data: { status },
      include: reportInclude,
    });
    await safeLogOperation(req, {
      action: "update_parent_report_status",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { from: existing.status.toLowerCase(), to: req.body.status },
    });
    return ok(res, toParentReport(report));
  })
);

reportsRouter.post(
  "/:id/send",
  requireRoles("admin", "academic_manager"),
  validate({ params: idParamSchema, body: sendReportSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw notFound("Parent report");
    if (existing.status === ParentReportStatus.ARCHIVED) throw badRequest("已归档报告不能发送");
    const report = await prisma.parentReport.update({
      where: { id: existing.id },
      data: {
        status: ParentReportStatus.SENT,
        sentAt: new Date(),
        sentBy: req.user.id,
        sentChannel: req.body.channel ?? "wecom",
      },
      include: reportInclude,
    });
    await safeLogOperation(req, {
      action: "send_parent_report",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { channel: report.sentChannel },
    });
    return ok(res, toParentReport(report));
  })
);
