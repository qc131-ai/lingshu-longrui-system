import { AiActionStatus, AiActionType, StudentRiskStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { MockUser } from "../../middleware/auth.js";
import { assertActionAllowedForRole, jsonClone } from "./aiSafety.js";
import type { AllowedAiActionType } from "./aiSchemas.js";

function payloadObject(payload: Prisma.JsonValue): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function appendNote(existing: string | null | undefined, label: string, value: string) {
  const text = value.trim();
  if (!text) return existing ?? "";
  return [existing?.trim(), `[AI] ${label}：${text}`].filter(Boolean).join("\n");
}

async function ensureStudent(user: MockUser, studentId: unknown) {
  if (typeof studentId !== "string") throw new AppError(400, "BAD_REQUEST", "AI 动作缺少有效 studentId");
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      organizationId: user.organizationId,
      deletedAt: null,
      ...(user.role === "advisor" ? { advisorId: user.id } : {}),
    },
  });
  if (!student) throw notFound("Student");
  return student;
}

async function ensureReport(user: MockUser, reportId: unknown) {
  if (typeof reportId !== "string") throw new AppError(400, "BAD_REQUEST", "AI 动作缺少有效 reportId");
  const report = await prisma.parentReport.findFirst({
    where: {
      id: reportId,
      organizationId: user.organizationId,
      ...(user.role === "advisor" ? { advisorId: user.id } : {}),
    },
  });
  if (!report) throw notFound("Parent report");
  return report;
}

async function ensureLeaveMakeup(user: MockUser, requestId: unknown) {
  if (typeof requestId !== "string") throw new AppError(400, "BAD_REQUEST", "AI 动作缺少有效 leaveMakeupRequestId");
  const request = await prisma.leaveMakeupRequest.findFirst({
    where: {
      id: requestId,
      organizationId: user.organizationId,
      ...(user.role === "advisor" ? { student: { advisorId: user.id } } : {}),
    },
  });
  if (!request) throw notFound("Leave makeup request");
  return request;
}

async function executeByType(user: MockUser, actionType: AiActionType, payload: Record<string, unknown>) {
  if (actionType === AiActionType.CREATE_PARENT_MESSAGE) {
    const student = await ensureStudent(user, payload.studentId);
    const message = typeof payload.message === "string" ? payload.message : "已生成家长沟通话术。";
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { notes: appendNote(student.notes, "家长沟通话术", message) },
      select: { id: true, name: true },
    });
    return { studentId: updated.id, studentName: updated.name, message };
  }
  if (actionType === AiActionType.CREATE_ADVISOR_FOLLOW_UP) {
    const student = await ensureStudent(user, payload.studentId);
    const note = typeof payload.note === "string" ? payload.note : "请顾问跟进该学生。";
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { notes: appendNote(student.notes, "顾问跟进任务", note), riskStatus: StudentRiskStatus.MEDIUM },
      select: { id: true, name: true, riskStatus: true },
    });
    return { studentId: updated.id, studentName: updated.name, riskStatus: updated.riskStatus.toLowerCase(), note };
  }
  if (actionType === AiActionType.GENERATE_RENEWAL_SUGGESTION) {
    const student = await ensureStudent(user, payload.studentId);
    const suggestion = typeof payload.suggestion === "string" ? payload.suggestion : "已生成续费建议。";
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { aiLearningSummary: appendNote(student.aiLearningSummary, "续费建议", suggestion) },
      select: { id: true, name: true },
    });
    return { studentId: updated.id, studentName: updated.name, suggestion };
  }
  if (actionType === AiActionType.POLISH_PARENT_REPORT) {
    const report = await ensureReport(user, payload.reportId);
    const polishedContent = typeof payload.polishedContent === "string" ? payload.polishedContent : "已生成报告润色草稿。";
    const updated = await prisma.parentReport.update({
      where: { id: report.id },
      data: { parentVisibleContent: appendNote(report.parentVisibleContent, "AI 润色草稿", polishedContent) },
      select: { id: true, title: true, status: true },
    });
    return { reportId: updated.id, title: updated.title, status: updated.status.toLowerCase() };
  }
  if (actionType === AiActionType.MARK_STUDENT_FOLLOW_UP_NEEDED) {
    const student = await ensureStudent(user, payload.studentId);
    const reason = typeof payload.reason === "string" ? payload.reason : "AI 标记需要顾问跟进。";
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { riskStatus: StudentRiskStatus.MEDIUM, notes: appendNote(student.notes, "需要顾问跟进", reason) },
      select: { id: true, name: true, riskStatus: true },
    });
    return { studentId: updated.id, studentName: updated.name, riskStatus: updated.riskStatus.toLowerCase(), reason };
  }
  if (actionType === AiActionType.CREATE_LEAVE_MAKEUP_NOTE) {
    const request = await ensureLeaveMakeup(user, payload.leaveMakeupRequestId);
    const note = typeof payload.note === "string" ? payload.note : "已生成请假补课处理备注。";
    const updated = await prisma.leaveMakeupRequest.update({
      where: { id: request.id },
      data: { approvalNote: appendNote(request.approvalNote, "处理备注", note) },
      select: { id: true, status: true, approvalNote: true },
    });
    return { leaveMakeupRequestId: updated.id, status: updated.status.toLowerCase(), note };
  }
  throw new AppError(400, "BAD_REQUEST", "不支持的 AI 动作类型");
}

export async function executeAiAction(input: { user: MockUser; actionId: string; actionType: AllowedAiActionType }) {
  const action = await prisma.aiAction.findFirst({
    where: { id: input.actionId, organizationId: input.user.organizationId },
  });
  if (!action) throw notFound("AI action");
  if (action.actionType !== input.actionType) throw new AppError(400, "BAD_REQUEST", "AI 动作类型不匹配");
  assertActionAllowedForRole(input.user, action.actionType as AllowedAiActionType);
  if (action.status === AiActionStatus.EXECUTED) throw new AppError(409, "CONFLICT", "该 AI 动作已执行");
  if (action.status === AiActionStatus.CANCELLED) throw new AppError(409, "CONFLICT", "该 AI 动作已取消");
  if (action.status !== AiActionStatus.PROPOSED) throw new AppError(409, "CONFLICT", "该 AI 动作当前不可执行");
  if (action.expiresAt < new Date()) {
    await prisma.aiAction.update({ where: { id: action.id }, data: { status: AiActionStatus.EXPIRED } });
    throw new AppError(409, "CONFLICT", "该 AI 动作已过期");
  }

  try {
    const result = await executeByType(input.user, action.actionType, payloadObject(action.payload));
    const updated = await prisma.aiAction.update({
      where: { id: action.id },
      data: {
        status: AiActionStatus.EXECUTED,
        executedAt: new Date(),
        executionResult: jsonClone(result),
      },
    });
    return { action: updated, result };
  } catch (error) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: {
        status: AiActionStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "AI 动作执行失败",
      },
    });
    throw error;
  }
}

