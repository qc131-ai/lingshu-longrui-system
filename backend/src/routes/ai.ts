import { randomUUID } from "node:crypto";
import { Router } from "express";
import { AiMessageRole, AiQueryIntent, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/response.js";
import { toLessonRecord, toStudent } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import { aiAssistantSchema } from "../validators/schemas.js";

export const aiRouter = Router();

function detectIntent(message: string) {
  if (message.includes("低课时") || message.includes("课时低于") || message.includes("课时不足") || message.includes("预警")) {
    return AiQueryIntent.CREDIT_WARNING;
  }
  if (message.includes("未提交") || message.includes("反馈")) return "feedback_pending";
  if (message.includes("作业") || message.includes("逾期")) return "homework_overdue";
  if (message.includes("报告") || message.includes("摘要")) return AiQueryIntent.REPORT;
  return AiQueryIntent.DEFAULT;
}

aiRouter.post(
  "/assistant",
  validate({ body: aiAssistantSchema }),
  asyncHandler(async (req, res) => {
    const { message, sessionId = randomUUID() } = req.body;
    const intent = detectIntent(message);

    let result: Prisma.InputJsonValue;
    let reply = "";

    if (intent === AiQueryIntent.CREDIT_WARNING) {
      const students = await prisma.student.findMany({
        where: { organizationId: req.user.organizationId, creditAccounts: { some: { balance: { lte: 5 } } }, deletedAt: null },
        include: { creditAccounts: true },
        orderBy: { createdAt: "desc" },
      });
      result = { intent: "credit_warning", students: students.map(toStudent) };
      reply = `我找到了 ${students.length} 名低课时学生。`;
    } else if (intent === "feedback_pending") {
      const records = await prisma.lessonRecord.findMany({
        where: { organizationId: req.user.organizationId, feedbackStatus: "PENDING" },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true } },
          teacher: { select: { name: true } },
        },
        orderBy: { lessonDate: "desc" },
        take: 20,
      });
      result = {
        intent: "feedback_pending",
        count: records.length,
        records: records.map(toLessonRecord),
      };
      reply = `当前有 ${records.length} 条老师反馈待提交。`;
    } else if (intent === "homework_overdue") {
      const today = new Date();
      const records = await prisma.lessonRecord.findMany({
        where: {
          homeworkDueAt: { lt: today },
          homeworkSubmittedAt: null,
          organizationId: req.user.organizationId,
        },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true } },
          teacher: { select: { name: true } },
        },
        orderBy: { homeworkDueAt: "asc" },
        take: 20,
      });
      result = {
        intent: "homework_overdue",
        count: records.length,
        records: records.map(toLessonRecord),
      };
      reply = `当前有 ${records.length} 条作业可能逾期。`;
    } else if (intent === AiQueryIntent.REPORT) {
      const student = await prisma.student.findFirst({
        where: { organizationId: req.user.organizationId },
        include: { creditAccounts: true },
        orderBy: { updatedAt: "desc" },
      });
      const summary = student
        ? `${student.name}本阶段学习状态稳定，剩余课时 ${student.creditAccounts.reduce((sum, account) => sum + account.balance.toNumber(), 0)}，建议持续关注作业完成情况。`
        : "暂无学员数据，无法生成报告摘要。";
      result = { intent: "report", summary };
      reply = summary;
    } else {
      result = {
        intent: "default",
        fallbackText: "可以尝试询问：低课时学生、老师未提交反馈、作业逾期、生成家长报告摘要。",
      };
      reply = "我还在学习中，可以先处理低课时、反馈、作业和报告摘要查询。";
    }

    await prisma.aiMessage.createMany({
      data: [
        {
          organizationId: req.user.organizationId,
          userId: req.user.id,
          sessionId,
          role: AiMessageRole.USER,
          content: message,
        },
        {
          organizationId: req.user.organizationId,
          userId: req.user.id,
          sessionId,
          role: AiMessageRole.ASSISTANT,
          content: reply,
          intent: typeof intent === "string" && intent in AiQueryIntent ? (intent as AiQueryIntent) : AiQueryIntent.DEFAULT,
          structuredResult: result,
        },
      ],
    });

    return ok(res, result);
  })
);
