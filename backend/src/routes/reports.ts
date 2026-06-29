import { Router } from "express";
import { ParentReportStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { toNumber, toParentReport } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  generateReportSchema,
  idParamSchema,
  sendReportSchema,
  updateReportStatusSchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";
import { reportScope } from "../lib/accessScope.js";

export const reportsRouter = Router();

function defaultPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start, end };
}

reportsRouter.post(
  "/generate",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ body: generateReportSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const period = defaultPeriod();
    const periodStart = input.periodStart ? new Date(`${input.periodStart}T00:00:00.000Z`) : period.start;
    const periodEnd = input.periodEnd ? new Date(`${input.periodEnd}T00:00:00.000Z`) : period.end;

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        advisor: { select: { id: true, displayName: true } },
        lessonRecords: {
          where: { lessonDate: { gte: periodStart, lte: periodEnd } },
          include: {
            class: { include: { course: true } },
            teacher: { select: { name: true } },
          },
          orderBy: { lessonDate: "asc" },
        },
      },
    });
    if (!student || student.organizationId !== req.user.organizationId) throw notFound("Student");
    if (req.user.role === "advisor" && student.advisorId !== req.user.id) throw notFound("Student");

    const records = student.lessonRecords;
    const completed = records.filter((record) => record.status === "COMPLETED");
    const submittedHomework = records.filter((record) => Boolean(record.homework));
    const monthlyHours = completed.reduce((sum, record) => sum + toNumber(record.creditsConsumed), 0);
    const courses = [...new Set(records.map((record) => record.class.course.name))];
    const aiSummary = `${student.name}家长您好，本阶段共完成 ${completed.length} 次课程，累计 ${monthlyHours} 小时。整体学习节奏稳定，请继续关注课后作业完成情况。`;

    const report = await prisma.parentReport.create({
      data: {
        studentId: student.id,
        organizationId: req.user.organizationId,
        advisorId: student.advisor?.id,
        periodLabel: `${periodStart.toISOString().slice(0, 10)} 至 ${periodEnd.toISOString().slice(0, 10)}`,
        periodStart,
        periodEnd,
        studentName: student.name,
        grade: student.grade,
        coursesSummary: courses.join("、") || "暂无课程",
        monthlyHours,
        attendanceRate: records.length ? (completed.length / records.length) * 100 : 0,
        homeworkRate: records.length ? (submittedHomework.length / records.length) * 100 : 0,
        scoreImprovement: Number(student.recentTestScore ?? 0),
        courseRecords: records.map((record) => ({
          date: record.lessonDate.toISOString().slice(0, 10),
          course: record.class.course.name,
          topic: record.topic ?? "",
          teacher: record.teacher.name,
          feedback: record.performance ?? record.aiSummary ?? "",
        })),
        aiSummary,
        trendData: [
          { name: "阶段1", score: Math.max(60, Number(student.recentTestScore ?? 80) - 8) },
          { name: "当前", score: Number(student.recentTestScore ?? 88) },
        ],
        radarData: [
          { subject: "课堂参与", A: 85, fullMark: 100 },
          { subject: "作业完成", A: records.length ? Math.round((submittedHomework.length / records.length) * 100) : 80, fullMark: 100 },
          { subject: "知识掌握", A: Number(student.recentTestScore ?? 86), fullMark: 100 },
        ],
        status: ParentReportStatus.GENERATED,
        generatedAt: new Date(),
      },
    });

    await prisma.aiTask.create({
      data: {
        taskType: "PARENT_REPORT_SUMMARY",
        organizationId: req.user.organizationId,
        status: "COMPLETED",
        studentId: student.id,
        parentReportId: report.id,
        inputPayload: { studentId: student.id, periodStart, periodEnd },
        outputPayload: { summary: aiSummary },
        completedAt: new Date(),
      },
    });

    await logOperation(req, {
      action: "generate_parent_report",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { studentId: student.id, periodStart, periodEnd },
    });

    return created(res, toParentReport(report));
  })
);

reportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const reports = await prisma.parentReport.findMany({
      where: { organizationId: req.user.organizationId, ...reportScope(req.user) },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, reports.map(toParentReport));
  })
);

reportsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...reportScope(req.user) },
    });
    if (!report) throw notFound("Parent report");
    return ok(res, toParentReport(report));
  })
);

reportsRouter.put(
  "/:id",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: updateReportStatusSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...reportScope(req.user) },
    });
    if (!existing) throw notFound("Parent report");
    const report = await prisma.parentReport.update({
      where: { id: existing.id },
      data: { status: toPrismaEnum(req.body.status) as ParentReportStatus },
    });
    return ok(res, toParentReport(report));
  })
);

reportsRouter.post(
  "/:id/send",
  requireRoles("admin", "academic_manager", "advisor"),
  validate({ params: idParamSchema, body: sendReportSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parentReport.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, ...reportScope(req.user) },
    });
    if (!existing) throw notFound("Parent report");
    const report = await prisma.parentReport.update({
      where: { id: existing.id },
      data: {
        status: ParentReportStatus.SENT,
        sentAt: new Date(),
        sentChannel: req.body.channel ?? "wecom",
      },
    });
    await logOperation(req, {
      action: "send_parent_report",
      resourceType: "parent_report",
      resourceId: report.id,
      detail: { channel: report.sentChannel },
    });
    return ok(res, {
      success: true,
      sentAt: report.sentAt,
      channel: report.sentChannel,
      report: toParentReport(report),
    });
  })
);
