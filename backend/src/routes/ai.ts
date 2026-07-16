import { randomUUID } from "node:crypto";
import { Router } from "express";
import { AiActionStatus, AiMessageRole, AiQueryIntent, Prisma, type AiAction } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/response.js";
import { toNumber } from "../lib/mappers.js";
import { teacherProfileId } from "../lib/accessScope.js";
import { logOperation } from "../lib/operationLog.js";
import { validate } from "../middleware/validate.js";
import {
  aiAssistantSchema,
  cancelAiActionSchema,
  confirmAiActionSchema,
  generateParentMessageSchema,
  generateRenewalSuggestionSchema,
  idParamSchema,
  polishReportSchema,
  studentRiskSummarySchema,
} from "../validators/schemas.js";
import type { MockUser } from "../middleware/auth.js";
import { AppError, notFound } from "../lib/errors.js";
import { getAiProvider } from "../services/ai/aiProvider.js";
import { allowedAiActionTypes } from "../services/ai/aiSchemas.js";
import { collectAiAgentData } from "../services/ai/aiDataCollector.js";
import { sanitizeProviderResponse } from "../services/ai/aiSafety.js";

export const aiRouter = Router();

type AiIntent =
  | "low_credit_students"
  | "missing_teacher_feedback"
  | "academic_todo"
  | "leave_makeup_pending"
  | "parent_report_pending"
  | "student_risk"
  | "unknown";

type AiCardAction = {
  label: string;
  type: "navigate" | "toast" | "mock" | "generate";
  target?: string;
  message?: string;
  payload?: Record<string, unknown>;
};

type AiCard = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  priority?: "high" | "medium" | "low";
  fields: Array<{ label: string; value: string | number }>;
  actions: AiCardAction[];
  data?: Record<string, unknown>;
};

type AiResponse = {
  answer: string;
  intent: AiIntent;
  cards: AiCard[];
  actions: AiCardAction[];
  relatedData?: Record<string, unknown>;
};

type RequestContext = {
  user: MockUser;
  teacherId: string | null;
};

function detectIntent(message: string): AiIntent {
  const normalized = message.trim();
  if (/(低课时|续费|剩余课时|课时低于|课时不足|课时预警)/.test(normalized)) return "low_credit_students";
  if (/(老师|反馈|没提交|未提交|课后反馈)/.test(normalized)) return "missing_teacher_feedback";
  if (/(请假|补课|调课|改课)/.test(normalized)) return "leave_makeup_pending";
  if (/(报告|家长|发送|未生成|没生成)/.test(normalized)) return "parent_report_pending";
  if (/(待办|今天|今日|本周|没处理)/.test(normalized)) return "academic_todo";
  if (/(风险|跟进|高风险|需要顾问)/.test(normalized)) return "student_risk";
  return "unknown";
}

function mapStoredIntent(intent: AiIntent) {
  if (intent === "low_credit_students") return AiQueryIntent.CREDIT_WARNING;
  if (intent === "leave_makeup_pending") return AiQueryIntent.MAKEUP;
  if (intent === "parent_report_pending") return AiQueryIntent.REPORT;
  return AiQueryIntent.DEFAULT;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shortDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "-";
}

function formatTime(value: Date | null | undefined) {
  if (!value) return "-";
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function deniedResponse(intent: AiIntent, message: string): AiResponse {
  return {
    answer: message,
    intent,
    cards: [],
    actions: [],
    relatedData: { permissionDenied: true },
  };
}

function creditScope(ctx: RequestContext): Prisma.CreditAccountWhereInput {
  if (ctx.user.role === "advisor") return { student: { advisorId: ctx.user.id } };
  if (ctx.user.role === "teacher") {
    return ctx.teacherId ? { course: { lessonRecords: { some: { teacherId: ctx.teacherId } } } } : { id: "__no_teacher_profile__" };
  }
  return {};
}

function lessonScope(ctx: RequestContext): Prisma.LessonRecordWhereInput {
  if (ctx.user.role === "advisor") return { student: { advisorId: ctx.user.id } };
  if (ctx.user.role === "teacher") return ctx.teacherId ? { teacherId: ctx.teacherId } : { id: "__no_teacher_profile__" };
  return {};
}

function leaveScope(ctx: RequestContext): Prisma.LeaveMakeupRequestWhereInput {
  if (ctx.user.role === "advisor") return { student: { advisorId: ctx.user.id } };
  if (ctx.user.role === "teacher") return ctx.teacherId ? { teacherId: ctx.teacherId } : { id: "__no_teacher_profile__" };
  return {};
}

function reportScope(ctx: RequestContext): Prisma.ParentReportWhereInput {
  if (ctx.user.role === "advisor") return { student: { advisorId: ctx.user.id } };
  if (ctx.user.role === "teacher") return { id: "__teacher_cannot_view_reports__" };
  return {};
}

async function logAiOperation(req: Parameters<typeof logOperation>[0], action: string, detail?: unknown) {
  await logOperation(req, { action, resourceType: "ai_assistant", detail });
}

function requireAiRoles(user: MockUser, roles: MockUser["role"][], message = "当前账号无权使用该 AI 生成功能") {
  if (!roles.includes(user.role)) throw new AppError(403, "FORBIDDEN", message);
}

function canManageAiAction(user: MockUser, action: AiAction) {
  if (user.role === "admin" || user.role === "academic_manager") return true;
  return user.role === "advisor" && action.userId === user.id;
}

function aiActionStatus(status: AiActionStatus) {
  return status.toLowerCase() as "proposed" | "executed" | "cancelled" | "expired" | "failed";
}

function toClientAiAction(action: AiAction) {
  return {
    id: action.id,
    actionType: action.actionType,
    title: action.title,
    description: action.description,
    payload: action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
      ? action.payload as Record<string, unknown>
      : {},
    status: aiActionStatus(action.status),
    riskLevel: action.riskLevel,
    confidence: toNumber(action.confidence),
    expiresAt: action.expiresAt.toISOString(),
    executedAt: action.executedAt?.toISOString() ?? null,
    cancelledAt: action.cancelledAt?.toISOString() ?? null,
    executionResult: action.executionResult ?? null,
    errorMessage: action.errorMessage,
    requiresConfirmation: action.requiresConfirmation,
  };
}

function buildAiActionExecutionResult(action: AiAction, confirmationNote?: string): Record<string, unknown> {
  const payload = action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
    ? action.payload as Record<string, unknown>
    : {};
  const generatedAt = new Date().toISOString();
  const text = typeof payload.message === "string"
    ? payload.message
    : typeof payload.content === "string"
      ? payload.content
      : typeof payload.draft === "string"
        ? payload.draft
        : action.description;

  const resultByType: Record<string, Record<string, unknown>> = {
    CREATE_PARENT_MESSAGE: {
      resultType: "parent_message_draft",
      content: text,
      note: "已生成家长沟通草稿，未自动发送给家长。",
    },
    CREATE_ADVISOR_FOLLOW_UP: {
      resultType: "advisor_follow_up_note",
      content: text,
      note: "已生成顾问跟进建议，未自动创建外部通知。",
    },
    GENERATE_RENEWAL_SUGGESTION: {
      resultType: "renewal_suggestion",
      content: text,
      note: "已生成续费建议草稿，未自动发送或修改订单。",
    },
    POLISH_PARENT_REPORT: {
      resultType: "polished_report_draft",
      content: text,
      note: "已生成报告润色草稿，未自动覆盖原报告。",
    },
    MARK_STUDENT_FOLLOW_UP_NEEDED: {
      resultType: "student_follow_up_marker",
      content: text,
      note: "已记录学生跟进建议，未修改学生业务状态。",
    },
    CREATE_LEAVE_MAKEUP_NOTE: {
      resultType: "leave_makeup_note",
      content: text,
      note: "已生成请假补课处理备注，未自动审批或排课。",
    },
  };

  return {
    ...(resultByType[action.actionType] ?? { resultType: "ai_action_result", content: text }),
    confirmationNote: confirmationNote ?? null,
    generatedAt,
  };
}

function tonePrefix(tone?: string) {
  if (tone === "friendly" || tone === "warm") return "语气建议：亲切自然。";
  if (tone === "urgent") return "语气建议：重点明确，但避免制造焦虑。";
  if (tone === "concise") return "语气建议：简洁清晰。";
  return "语气建议：专业稳妥。";
}

function riskFromCredits(remainingHours: number, pendingLeaveCount: number, reportPending: boolean) {
  if (remainingHours <= 3 || pendingLeaveCount >= 2) return "high";
  if (remainingHours <= 5 || pendingLeaveCount > 0 || reportPending) return "medium";
  return "low";
}

function riskLabel(level: string) {
  if (level === "high") return "高";
  if (level === "medium") return "中";
  return "低";
}

function stringifyTags(tags: Prisma.JsonValue | null | undefined) {
  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string").join("、") : "";
}

function dateRangeInput(periodStart?: string, periodEnd?: string) {
  const where: Prisma.DateTimeFilter = {};
  if (periodStart) where.gte = new Date(`${periodStart}T00:00:00.000Z`);
  if (periodEnd) where.lte = new Date(`${periodEnd}T23:59:59.999Z`);
  return Object.keys(where).length > 0 ? where : undefined;
}

async function ensureStudentAccess(req: Parameters<typeof logOperation>[0], studentId: string, options: { allowTeacher?: boolean } = {}) {
  const teacherId = options.allowTeacher ? await teacherProfileId(req.user) : null;
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      organizationId: req.user.organizationId,
      deletedAt: null,
      ...(req.user.role === "advisor" ? { advisorId: req.user.id } : {}),
      ...(req.user.role === "teacher"
        ? teacherId
          ? { lessonRecords: { some: { teacherId } } }
          : { id: "__no_teacher_profile__" }
        : {}),
    },
    include: {
      advisor: { select: { id: true, displayName: true } },
    },
  });
  if (!student) throw notFound("Student");
  return { student, teacherId };
}

async function collectStudentAiData(
  req: Parameters<typeof logOperation>[0],
  studentId: string,
  courseId?: string,
  options: { allowTeacher?: boolean; periodStart?: string; periodEnd?: string } = {}
) {
  const { student, teacherId } = await ensureStudentAccess(req, studentId, { allowTeacher: options.allowTeacher });
  const lessonDate = dateRangeInput(options.periodStart, options.periodEnd);
  const courseFilter = courseId ? { courseId } : {};
  const teacherFilter = req.user.role === "teacher" && teacherId ? { teacherId } : {};

  const [creditAccounts, lessons, leaves, reports] = await Promise.all([
    prisma.creditAccount.findMany({
      where: { organizationId: req.user.organizationId, studentId, status: "active", ...courseFilter },
      include: { course: { select: { id: true, name: true } } },
      orderBy: [{ balance: "asc" }, { updatedAt: "desc" }],
      take: courseId ? 1 : 5,
    }),
    prisma.lessonRecord.findMany({
      where: {
        organizationId: req.user.organizationId,
        studentId,
        ...(lessonDate ? { lessonDate } : {}),
        ...courseFilter,
        ...teacherFilter,
      },
      include: { course: { select: { id: true, name: true } }, teacher: { select: { name: true } } },
      orderBy: [{ lessonDate: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.leaveMakeupRequest.findMany({
      where: {
        organizationId: req.user.organizationId,
        studentId,
        status: { in: ["PENDING", "MAKEUP_PENDING", "MAKEUP_SCHEDULED"] },
        ...courseFilter,
      },
      include: { course: { select: { name: true } }, teacher: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    req.user.role === "teacher"
      ? Promise.resolve([])
      : prisma.parentReport.findMany({
          where: {
            organizationId: req.user.organizationId,
            studentId,
            ...courseFilter,
            ...(req.user.role === "advisor" ? { advisorId: req.user.id } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            periodLabel: true,
            summary: true,
            teacherFeedbackSummary: true,
            weaknessAnalysis: true,
            nextStepPlan: true,
            parentVisibleContent: true,
            sentAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 3,
        }),
  ]);

  return { student, creditAccounts, lessons, leaves, reports };
}

function buildStudentSummary(data: Awaited<ReturnType<typeof collectStudentAiData>>) {
  const { student, lessons } = data;
  const recentLesson = lessons[0];
  return `${student.name}，${student.grade}${student.school ? `，目前就读于${student.school}` : ""}。负责顾问：${student.advisor?.displayName ?? "未分配"}。${
    stringifyTags(student.tags) ? `标签：${stringifyTags(student.tags)}。` : ""
  }最近课程：${recentLesson ? `${shortDate(recentLesson.lessonDate)} ${recentLesson.course?.name ?? "课程"}` : "暂无最近上课记录"}。`;
}

function buildCreditSummary(accounts: Awaited<ReturnType<typeof collectStudentAiData>>["creditAccounts"]) {
  if (accounts.length === 0) return "暂未找到该学员对应课程的课时账户。";
  return accounts
    .map((account) => {
      const remaining = toNumber(account.balance);
      return `${account.course?.name ?? "未绑定课程"}：已购 ${toNumber(account.totalPurchased)}，已消耗 ${toNumber(account.totalConsumed)}，剩余 ${remaining} 课时${remaining <= 5 ? "（低课时）" : ""}`;
    })
    .join("；");
}

function summarizeRecentFeedback(lessons: Awaited<ReturnType<typeof collectStudentAiData>>["lessons"]) {
  const feedback = lessons
    .map((lesson) => lesson.aiSummary || lesson.performance || lesson.knowledgeMastery || lesson.topic)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
  return feedback.length > 0 ? feedback.join("；") : "暂无可引用的老师反馈。";
}

function buildRenewalSuggestion(data: Awaited<ReturnType<typeof collectStudentAiData>>, tone?: string) {
  const primaryAccount = data.creditAccounts[0];
  const remainingHours = primaryAccount ? toNumber(primaryAccount.balance) : 0;
  const pendingLeaveCount = data.leaves.filter((item) => item.status === "PENDING" || item.status === "MAKEUP_PENDING").length;
  const latestReport = data.reports[0];
  const reportPending = latestReport ? latestReport.status !== "SENT" : true;
  const riskLevel = riskFromCredits(remainingHours, pendingLeaveCount, reportPending);
  const courseName = primaryAccount?.course?.name ?? data.lessons[0]?.course?.name ?? "当前课程";
  const feedbackSummary = summarizeRecentFeedback(data.lessons);

  const reasons: string[] = [];
  if (remainingHours <= 3) reasons.push(`剩余课时仅 ${remainingHours} 小时，需要优先规划续课`);
  else if (remainingHours <= 5) reasons.push(`剩余课时 ${remainingHours} 小时，已进入续费提醒区间`);
  else reasons.push(`当前剩余 ${remainingHours} 小时，可提前做学习规划沟通`);
  if (feedbackSummary !== "暂无可引用的老师反馈。") reasons.push("近期老师反馈可作为学习成效沟通素材");
  if (pendingLeaveCount > 0) reasons.push("存在待处理请假补课，建议先同步服务安排");
  if (reportPending) reasons.push("家长报告尚未完成发送，建议先用报告建立沟通基础");

  const renewalSuggestion = [
    `${tonePrefix(tone)}建议以“学习规划复盘 + 后续目标安排”的方式推进 ${courseName} 续费沟通。`,
    `当前判断为${riskLabel(riskLevel)}优先级：${reasons.join("；")}。`,
    pendingLeaveCount > 0 ? "正式谈续费前，先把补课安排和服务进度说明清楚，减少家长顾虑。" : "可以先肯定近期学习投入，再自然提出后续课程连续性的必要性。",
  ].join("\n");

  const parentMessage = `您好，${data.student.name}近期在${courseName}的学习我们已经做了阶段整理。${feedbackSummary} 当前课程剩余约 ${remainingHours} 小时，建议我们提前规划后续学习节奏，避免课程衔接中断。我这边可以先把近期学习情况和下一阶段建议同步给您，您看方便时我们沟通一下。`;

  return {
    studentSummary: buildStudentSummary(data),
    creditSummary: buildCreditSummary(data.creditAccounts),
    riskLevel,
    renewalSuggestion,
    parentMessage,
    advisorTalkingPoints: [
      `先说明 ${data.student.name} 近期学习状态：${feedbackSummary}`,
      `明确 ${courseName} 剩余课时和后续学习目标`,
      pendingLeaveCount > 0 ? "先处理请假补课安排，再进入续费建议" : "用连续学习规划切入续费，不直接强销售",
      reportPending ? "优先发送或补齐家长报告，提升沟通可信度" : "结合已发送报告做复盘",
    ],
    nextActions: [
      reportPending ? "先生成或发送家长报告" : "约家长做阶段复盘",
      pendingLeaveCount > 0 ? "确认请假补课处理进度" : "准备续课方案与课时包建议",
      "记录顾问跟进结果",
    ],
  };
}

function buildParentScenarioMessage(
  scenario: string,
  data: Awaited<ReturnType<typeof collectStudentAiData>>,
  tone?: string
) {
  const account = data.creditAccounts[0];
  const remainingHours = account ? toNumber(account.balance) : 0;
  const courseName = account?.course?.name ?? data.lessons[0]?.course?.name ?? "课程";
  const feedbackSummary = summarizeRecentFeedback(data.lessons);
  const latestLeave = data.leaves[0];
  const latestReport = data.reports[0];
  const base = `${tonePrefix(tone)}请保持事实准确、温和具体。`;

  const templates: Record<string, { title: string; message: string; keyPoints: string[]; cautionNotes: string[] }> = {
    low_credit_reminder: {
      title: "低课时提醒话术",
      message: `您好，${data.student.name}目前${courseName}剩余约 ${remainingHours} 小时。近期学习情况我们也在持续跟进：${feedbackSummary} 建议提前规划后续课程安排，避免学习节奏中断。`,
      keyPoints: [`剩余课时：${remainingHours}`, `课程：${courseName}`, "提醒规划，不直接强销售"],
      cautionNotes: ["不要制造焦虑", "不要承诺未确认的优惠或成绩结果"],
    },
    progress_update: {
      title: "学习进步反馈话术",
      message: `您好，和您同步一下${data.student.name}近期${courseName}的学习情况：${feedbackSummary} 下一阶段我们会继续围绕薄弱点做巩固，并保持课堂反馈同步。`,
      keyPoints: ["引用老师真实反馈", "说明下一阶段目标", "语气正向"],
      cautionNotes: ["不要编造成绩提升", "避免夸大效果"],
    },
    makeup_notice: {
      title: "请假补课通知话术",
      message: `您好，${data.student.name}的${courseName}课程有一条${latestLeave ? `${latestLeave.requestType.toLowerCase()}申请，当前状态为${latestLeave.status.toLowerCase()}` : "请假补课安排需要同步"}。我们会尽快确认补课时间、老师和教室，并在确认后第一时间通知您。`,
      keyPoints: ["说明原课程变动", "同步补课处理状态", "明确后续通知"],
      cautionNotes: ["不要写入未确认的补课时间", "避免责任归因表达"],
    },
    renewal_followup: {
      title: "续费跟进话术",
      message: `您好，${data.student.name}目前${courseName}剩余约 ${remainingHours} 小时。结合近期课堂反馈：${feedbackSummary} 建议我们提前讨论后续学习目标和课程安排，保证学习连续性。`,
      keyPoints: ["结合剩余课时", "结合学习目标", "自然提出续课建议"],
      cautionNotes: ["避免强迫式催促", "不要承诺未确认价格"],
    },
    report_delivery: {
      title: "家长报告发送说明",
      message: `您好，${data.student.name}的阶段学习报告${latestReport ? `《${latestReport.title}》` : ""}已整理好，里面包含近期课程表现、学习重点和下一步建议。您方便时可以先查看，我们也可以再约时间沟通重点内容。`,
      keyPoints: ["说明报告已生成", "简述报告重点", "引导查看"],
      cautionNotes: ["不要暴露内部备注", "不要包含财务敏感信息"],
    },
    risk_followup: {
      title: "风险跟进话术",
      message: `您好，近期我们关注到${data.student.name}在${courseName}学习服务上有一些需要跟进的点。我们会先从课堂反馈、补课安排和后续学习计划三个方面协助梳理，目标是帮助孩子把节奏稳定下来。`,
      keyPoints: ["说明风险点", "给出改善方案", "降低焦虑感"],
      cautionNotes: ["避免使用严重负面标签", "不要把内部风险等级直接发给家长"],
    },
  };

  const selected = templates[scenario] ?? templates.progress_update;
  return {
    title: selected.title,
    message: `${selected.message}\n\n${base}`,
    keyPoints: selected.keyPoints,
    suggestedSendChannel: scenario === "low_credit_reminder" || scenario === "renewal_followup" ? "wecom" : "wecom",
    cautionNotes: selected.cautionNotes,
  };
}

function polishText(value: string | null | undefined, fallback: string, tone?: string) {
  const source = value?.trim() || fallback;
  if (tone === "concise") return source.replace(/\s+/g, " ").slice(0, 240);
  if (tone === "warm") return `${source}\n\n整体来看，孩子的学习推进是有基础的。建议后续继续保持课堂投入，并针对薄弱点做小步巩固。`;
  return `${source}\n\n建议下一阶段继续围绕课程目标推进，结合课堂反馈进行复盘，并保持与家长的阶段性沟通。`;
}


async function handleLowCredit(ctx: RequestContext): Promise<AiResponse> {
  const accounts = await prisma.creditAccount.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      status: "active",
      balance: { lte: 5 },
      ...creditScope(ctx),
    },
    include: {
      student: { select: { id: true, name: true, advisor: { select: { displayName: true } } } },
      course: { select: { id: true, name: true } },
    },
    orderBy: [{ balance: "asc" }, { updatedAt: "desc" }],
    take: 20,
  });

  const cards = accounts.map((account) => {
    const remainingHours = toNumber(account.balance);
    const risk = remainingHours <= 2 ? "high" : "medium";
    return {
      id: account.id,
      type: "low_credit_student",
      title: account.student.name,
      subtitle: account.course?.name ?? "未绑定课程",
      priority: risk,
      fields: [
        { label: "学员姓名", value: account.student.name },
        { label: "当前课程", value: account.course?.name ?? "未绑定课程" },
        { label: "剩余课时", value: remainingHours },
        { label: "负责顾问", value: account.student.advisor?.displayName ?? "未分配" },
        { label: "风险等级", value: risk === "high" ? "高风险" : "中风险" },
      ],
      actions: [
        { label: "查看学员", type: "navigate", target: "/students" },
        { label: "生成续费建议", type: "generate", target: "renewal_suggestion", payload: { studentId: account.studentId, courseId: account.courseId } },
        { label: "生成家长沟通话术", type: "generate", target: "parent_message", payload: { studentId: account.studentId, courseId: account.courseId, scenario: "low_credit_reminder" } },
        { label: "通知顾问", type: "toast", message: "已生成通知任务" },
      ],
      data: { studentId: account.studentId, courseId: account.courseId, creditAccountId: account.id },
    } satisfies AiCard;
  });

  return {
    answer: cards.length > 0 ? `我找到了 ${cards.length} 名剩余课时低于或等于 5 小时的学生。` : "当前没有剩余课时低于 5 小时的学生。",
    intent: "low_credit_students",
    cards,
    actions: [{ label: "查看订单课时", type: "navigate", target: "/orders" }],
    relatedData: { count: cards.length },
  };
}

async function handleMissingFeedback(ctx: RequestContext): Promise<AiResponse> {
  if (ctx.user.role === "finance") return deniedResponse("missing_teacher_feedback", "当前财务账号无权查询老师反馈数据。");

  const records = await prisma.lessonRecord.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      status: { in: ["DRAFT", "PENDING_FEEDBACK"] },
      ...lessonScope(ctx),
    },
    include: {
      teacher: { select: { id: true, name: true } },
      course: { select: { name: true } },
    },
    orderBy: [{ lessonDate: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const grouped = new Map<string, { teacherId: string; teacherName: string; count: number; courses: Set<string>; recent: Date | null }>();
  for (const record of records) {
    const key = record.teacherId;
    const current = grouped.get(key) ?? {
      teacherId: record.teacherId,
      teacherName: record.teacher.name,
      count: 0,
      courses: new Set<string>(),
      recent: null,
    };
    current.count += 1;
    if (record.course?.name) current.courses.add(record.course.name);
    if (!current.recent || record.lessonDate > current.recent) current.recent = record.lessonDate;
    grouped.set(key, current);
  }

  const cards = Array.from(grouped.values()).map((item) => ({
    id: item.teacherId,
    type: "missing_teacher_feedback",
    title: item.teacherName,
    subtitle: `${item.count} 条反馈待提交`,
    priority: item.count >= 5 ? "high" : item.count >= 2 ? "medium" : "low",
    fields: [
      { label: "老师姓名", value: item.teacherName },
      { label: "未提交数量", value: item.count },
      { label: "涉及课程", value: Array.from(item.courses).join("、") || "-" },
      { label: "最近课程时间", value: item.recent ? formatDate(item.recent) : "-" },
    ],
    actions: [
      { label: "提醒老师", type: "toast", message: "已生成提醒任务" },
      { label: "查看上课记录", type: "navigate", target: "/records" },
    ],
    data: { teacherId: item.teacherId },
  } satisfies AiCard));

  return {
    answer: cards.length > 0 ? `当前有 ${records.length} 条老师反馈尚未提交，涉及 ${cards.length} 位老师。` : "当前没有待提交的老师反馈。",
    intent: "missing_teacher_feedback",
    cards,
    actions: [{ label: "查看上课记录", type: "navigate", target: "/records" }],
    relatedData: { recordCount: records.length, teacherCount: cards.length },
  };
}

async function handleAcademicTodo(ctx: RequestContext): Promise<AiResponse> {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const scheduleWhere: Prisma.ScheduleWhereInput = {
    organizationId: ctx.user.organizationId,
    lessonDate: { gte: today, lt: tomorrow },
    status: { not: "CANCELLED" },
    ...(ctx.user.role === "teacher" ? (ctx.teacherId ? { teacherId: ctx.teacherId } : { id: "__no_teacher_profile__" }) : {}),
  };
  const lessonWhere: Prisma.LessonRecordWhereInput = {
    organizationId: ctx.user.organizationId,
    lessonDate: { gte: today, lt: weekEnd },
    status: { in: ["DRAFT", "PENDING_FEEDBACK"] },
    ...lessonScope(ctx),
  };

  const [todaySchedules, pendingFeedback, pendingLeaves, pendingReports, lowCredits] = await Promise.all([
    ctx.user.role === "finance" ? Promise.resolve(0) : prisma.schedule.count({ where: scheduleWhere }),
    ctx.user.role === "finance" ? Promise.resolve(0) : prisma.lessonRecord.count({ where: lessonWhere }),
    ctx.user.role === "finance"
      ? Promise.resolve(0)
      : prisma.leaveMakeupRequest.count({
          where: { organizationId: ctx.user.organizationId, status: { in: ["PENDING", "MAKEUP_PENDING"] }, ...leaveScope(ctx) },
        }),
    ctx.user.role === "finance" || ctx.user.role === "teacher"
      ? Promise.resolve(0)
      : prisma.parentReport.count({
          where: { organizationId: ctx.user.organizationId, status: { in: ["DRAFT", "GENERATED", "REVIEWED"] }, ...reportScope(ctx) },
        }),
    prisma.creditAccount.count({ where: { organizationId: ctx.user.organizationId, status: "active", balance: { lte: 5 }, ...creditScope(ctx) } }),
  ]);

  const todoItems = [
    { id: "today_schedules", title: "今日排课", count: todaySchedules, priority: todaySchedules > 10 ? "high" : "medium", target: "/schedule" },
    { id: "pending_feedback", title: "待提交反馈", count: pendingFeedback, priority: pendingFeedback > 5 ? "high" : "medium", target: "/records" },
    { id: "pending_leave_makeup", title: "待审批请假补课", count: pendingLeaves, priority: pendingLeaves > 0 ? "high" : "low", target: "/leaves" },
    { id: "pending_reports", title: "待发送家长报告", count: pendingReports, priority: pendingReports > 0 ? "medium" : "low", target: "/reports" },
    { id: "low_credits", title: "低课时预警", count: lowCredits, priority: lowCredits > 0 ? "high" : "low", target: "/orders" },
  ] as const;

  const cards = todoItems
    .filter((item) => item.count > 0)
    .map((item) => ({
      id: item.id,
      type: "academic_todo",
      title: item.title,
      subtitle: `${item.count} 项待处理`,
      priority: item.priority,
      fields: [
        { label: "类型", value: item.title },
        { label: "数量", value: item.count },
        { label: "优先级", value: item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低" },
      ],
      actions: [{ label: "进入处理", type: "navigate", target: item.target }],
      data: { todoType: item.id },
    } satisfies AiCard));

  return {
    answer: cards.length > 0 ? `我整理了 ${cards.length} 类教务待办，请优先处理高优先级事项。` : "今天暂无需要立即处理的教务待办。",
    intent: "academic_todo",
    cards,
    actions: [],
    relatedData: { todaySchedules, pendingFeedback, pendingLeaves, pendingReports, lowCredits },
  };
}

async function handleLeaveMakeup(ctx: RequestContext): Promise<AiResponse> {
  if (ctx.user.role === "finance") return deniedResponse("leave_makeup_pending", "当前财务账号无权查询请假补课数据。");

  const requests = await prisma.leaveMakeupRequest.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      status: { in: ["PENDING", "MAKEUP_PENDING"] },
      ...leaveScope(ctx),
    },
    include: {
      student: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
    take: 20,
  });

  const cards = requests.map((request) => ({
    id: request.id,
    type: "leave_makeup_pending",
    title: request.student?.name ?? request.class?.name ?? "未命名申请",
    subtitle: request.course.name,
    priority: request.status === "PENDING" ? "high" : "medium",
    fields: [
      { label: "学员 / 班级", value: request.student?.name ?? request.class?.name ?? "-" },
      { label: "课程", value: request.course.name },
      { label: "老师", value: request.teacher.name },
      { label: "申请类型", value: request.requestType.toLowerCase() },
      { label: "当前状态", value: request.status.toLowerCase() },
    ],
    actions: [
      { label: "查看申请", type: "navigate", target: "/leaves" },
      { label: "安排补课", type: "navigate", target: "/leaves" },
      { label: "通知家长", type: "toast", message: "已生成通知任务" },
    ],
    data: { requestId: request.id, studentId: request.studentId, classId: request.classId },
  } satisfies AiCard));

  return {
    answer: cards.length > 0 ? `当前有 ${cards.length} 条请假补课申请需要处理。` : "当前没有待处理的请假补课申请。",
    intent: "leave_makeup_pending",
    cards,
    actions: [{ label: "查看请假补课", type: "navigate", target: "/leaves" }],
    relatedData: { count: cards.length },
  };
}

async function handleParentReports(ctx: RequestContext): Promise<AiResponse> {
  if (ctx.user.role === "finance" || ctx.user.role === "teacher") {
    return deniedResponse("parent_report_pending", "当前账号无权查询家长报告数据。");
  }

  const { start, end } = monthRange();
  const reports = await prisma.parentReport.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      status: { in: ["DRAFT", "GENERATED", "REVIEWED"] },
      ...reportScope(ctx),
    },
    include: {
      student: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
  });
  const missingReports = await prisma.student.count({
    where: {
      organizationId: ctx.user.organizationId,
      deletedAt: null,
      ...(ctx.user.role === "advisor" ? { advisorId: ctx.user.id } : {}),
      parentReports: { none: { periodStart: { gte: start }, periodEnd: { lte: end } } },
    },
  });

  const cards = reports.map((report) => ({
    id: report.id,
    type: "parent_report_pending",
    title: report.student.name,
    subtitle: report.title,
    priority: report.status === "REVIEWED" ? "high" : "medium",
    fields: [
      { label: "学员姓名", value: report.student.name },
      { label: "报告类型", value: report.reportType.toLowerCase() },
      { label: "报告周期", value: report.periodLabel },
      { label: "当前状态", value: report.status.toLowerCase() },
    ],
    actions: [
      { label: "查看报告", type: "navigate", target: "/reports" },
      { label: "发送报告", type: "navigate", target: "/reports" },
      { label: "润色报告", type: "generate", target: "polish_report", payload: { reportId: report.id } },
      { label: "生成发送说明", type: "generate", target: "parent_message", payload: { studentId: report.studentId, courseId: report.courseId, scenario: "report_delivery" } },
    ],
    data: { reportId: report.id, studentId: report.studentId, courseId: report.courseId },
  } satisfies AiCard));

  return {
    answer:
      cards.length > 0 || missingReports > 0
        ? `当前有 ${cards.length} 份家长报告待发送或待审核，另有 ${missingReports} 名学生本月尚未生成报告。`
        : "当前没有待发送家长报告，本月报告覆盖也正常。",
    intent: "parent_report_pending",
    cards,
    actions: [{ label: "查看家长报告", type: "navigate", target: "/reports" }],
    relatedData: { pendingReportCount: cards.length, missingMonthlyReportCount: missingReports },
  };
}

async function handleStudentRisk(ctx: RequestContext): Promise<AiResponse> {
  const riskMap = new Map<string, { studentId: string; studentName: string; advisorName: string; reasons: string[]; score: number }>();
  const ensureRisk = (studentId: string, studentName: string, advisorName = "未分配") => {
    const existing = riskMap.get(studentId);
    if (existing) return existing;
    const created = { studentId, studentName, advisorName, reasons: [], score: 0 };
    riskMap.set(studentId, created);
    return created;
  };

  const [lowAccounts, followUpLessons, pendingLeaves, pendingReports] = await Promise.all([
    prisma.creditAccount.findMany({
      where: { organizationId: ctx.user.organizationId, status: "active", balance: { lte: 5 }, ...creditScope(ctx) },
      include: { student: { select: { id: true, name: true, advisor: { select: { displayName: true } } } }, course: { select: { name: true } } },
      take: 50,
    }),
    ctx.user.role === "finance"
      ? Promise.resolve([])
      : prisma.lessonRecord.findMany({
          where: { organizationId: ctx.user.organizationId, needAdvisorFollowUp: true, ...lessonScope(ctx) },
          include: { student: { select: { id: true, name: true, advisor: { select: { displayName: true } } } }, course: { select: { name: true } } },
          take: 50,
        }),
    ctx.user.role === "finance"
      ? Promise.resolve([])
      : prisma.leaveMakeupRequest.findMany({
          where: { organizationId: ctx.user.organizationId, status: { in: ["PENDING", "MAKEUP_PENDING"] }, studentId: { not: null }, ...leaveScope(ctx) },
          include: { student: { select: { id: true, name: true, advisor: { select: { displayName: true } } } }, course: { select: { name: true } } },
          take: 50,
        }),
    ctx.user.role === "finance" || ctx.user.role === "teacher"
      ? Promise.resolve([])
      : prisma.parentReport.findMany({
          where: { organizationId: ctx.user.organizationId, status: { in: ["DRAFT", "GENERATED", "REVIEWED"] }, ...reportScope(ctx) },
          include: { student: { select: { id: true, name: true, advisor: { select: { displayName: true } } } } },
          take: 50,
        }),
  ]);

  for (const account of lowAccounts) {
    const risk = ensureRisk(account.studentId, account.student.name, account.student.advisor?.displayName ?? "未分配");
    risk.reasons.push(`${account.course?.name ?? "课程"} 剩余 ${toNumber(account.balance)} 课时`);
    risk.score += toNumber(account.balance) <= 2 ? 3 : 2;
  }
  for (const lesson of followUpLessons) {
    if (!lesson.student) continue;
    const risk = ensureRisk(lesson.student.id, lesson.student.name, lesson.student.advisor?.displayName ?? "未分配");
    risk.reasons.push(`${lesson.course?.name ?? "课程"} 老师标记需顾问跟进`);
    risk.score += 2;
  }
  for (const request of pendingLeaves) {
    if (!request.student) continue;
    const risk = ensureRisk(request.student.id, request.student.name, request.student.advisor?.displayName ?? "未分配");
    risk.reasons.push(`${request.course.name} 请假补课待处理`);
    risk.score += 1;
  }
  for (const report of pendingReports) {
    const risk = ensureRisk(report.student.id, report.student.name, report.student.advisor?.displayName ?? "未分配");
    risk.reasons.push("家长报告待发送");
    risk.score += 1;
  }

  const cards = Array.from(riskMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((risk) => {
      const level = risk.score >= 4 ? "high" : risk.score >= 2 ? "medium" : "low";
      return {
        id: risk.studentId,
        type: "student_risk",
        title: risk.studentName,
        subtitle: risk.reasons.slice(0, 2).join("；"),
        priority: level,
        fields: [
          { label: "学员姓名", value: risk.studentName },
          { label: "风险原因", value: risk.reasons.join("；") },
          { label: "风险等级", value: level === "high" ? "高风险" : level === "medium" ? "中风险" : "低风险" },
          { label: "负责顾问", value: risk.advisorName },
          { label: "建议动作", value: "顾问跟进并同步教务处理进度" },
        ],
        actions: [
          { label: "查看学员", type: "navigate", target: "/students" },
          { label: "生成风险总结", type: "generate", target: "student_risk_summary", payload: { studentId: risk.studentId } },
          { label: "生成顾问跟进话术", type: "generate", target: "parent_message", payload: { studentId: risk.studentId, scenario: "risk_followup" } },
          { label: "通知顾问", type: "toast", message: "已生成通知任务" },
        ],
        data: { studentId: risk.studentId, reasons: risk.reasons },
      } satisfies AiCard;
    });

  return {
    answer: cards.length > 0 ? `我识别出 ${cards.length} 名需要优先跟进的学生。` : "当前没有识别到需要优先跟进的学生。",
    intent: "student_risk",
    cards,
    actions: [{ label: "查看学员", type: "navigate", target: "/students" }],
    relatedData: { count: cards.length },
  };
}

async function handleAssistantRequest(intent: AiIntent, ctx: RequestContext): Promise<AiResponse> {
  if (intent === "low_credit_students") return handleLowCredit(ctx);
  if (intent === "missing_teacher_feedback") return handleMissingFeedback(ctx);
  if (intent === "academic_todo") return handleAcademicTodo(ctx);
  if (intent === "leave_makeup_pending") return handleLeaveMakeup(ctx);
  if (intent === "parent_report_pending") return handleParentReports(ctx);
  if (intent === "student_risk") return handleStudentRisk(ctx);
  return {
    answer: "我暂时无法判断你的问题类型，可以试试：查询低课时学生、未提交反馈老师、待处理请假补课、待发送家长报告。",
    intent: "unknown",
    cards: [],
    actions: [
      { label: "查询低课时学生", type: "mock", message: "哪些学生课时低于 5 小时？" },
      { label: "查询未提交反馈老师", type: "mock", message: "哪些老师本周还没提交反馈？" },
      { label: "查询待处理请假补课", type: "mock", message: "哪些请假补课还没处理？" },
    ],
    relatedData: {},
  };
}

aiRouter.post(
  "/assistant",
  validate({ body: aiAssistantSchema }),
  asyncHandler(async (req, res) => {
    const { message, sessionId = randomUUID(), context } = req.body;
    const intent = detectIntent(message);
    const teacherId = await teacherProfileId(req.user);
    const ctx: RequestContext = { user: req.user, teacherId };

    const result = await handleAssistantRequest(intent, ctx);
    await logAiOperation(req, "ai_assistant_query", { intent: result.intent, message, context });
    if (intent !== "unknown") await logAiOperation(req, `ai_${intent}`, { cardCount: result.cards.length });

    const structuredResult = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
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
          content: result.answer,
          intent: mapStoredIntent(result.intent),
          structuredResult,
        },
      ],
    });

    return ok(res, result);
  })
);

aiRouter.post(
  "/agent",
  validate({ body: aiAssistantSchema }),
  asyncHandler(async (req, res) => {
    const { message, sessionId = randomUUID() } = req.body;
    const intent = detectIntent(message);
    const teacherId = await teacherProfileId(req.user);
    const ctx: RequestContext = { user: req.user, teacherId };

    const baseResult = await handleAssistantRequest(intent, ctx);
    const aiData = await collectAiAgentData(ctx);
    const provider = getAiProvider();
    const providerResult = await provider.generateAssistantResponse({
      message,
      intent: baseResult.intent,
      userRole: req.user.role,
      organization: aiData.organization,
      cards: baseResult.cards,
      dataSummary: aiData.summary,
      allowedActions: [...allowedAiActionTypes],
    });
    const safeProviderResult = sanitizeProviderResponse(providerResult, message);
    const providerName = process.env.AI_PROVIDER === "deepseek" && process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock";
    const isRestrictedAction = safeProviderResult.intent === "restricted_action";
    const persistedActions = isRestrictedAction ? [] : await Promise.all(safeProviderResult.proposedActions.map((action) => prisma.aiAction.create({
      data: {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        sessionId,
        message,
        intent: safeProviderResult.intent || baseResult.intent,
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        payload: JSON.parse(JSON.stringify(action.payload)) as Prisma.InputJsonValue,
        riskLevel: action.riskLevel,
        confidence: safeProviderResult.confidence,
        requiresConfirmation: action.requiresConfirmation,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })));

    const result = {
      answer: safeProviderResult.answer || baseResult.answer,
      intent: safeProviderResult.intent || baseResult.intent,
      cards: isRestrictedAction ? [] : safeProviderResult.cards.length > 0 ? safeProviderResult.cards : baseResult.cards,
      actions: isRestrictedAction ? [] : baseResult.actions,
      proposedActions: persistedActions.map(toClientAiAction),
      warnings: safeProviderResult.warnings,
      confidence: safeProviderResult.confidence,
      provider: providerName,
      relatedData: isRestrictedAction ? {} : baseResult.relatedData ?? {},
    };

    await logAiOperation(req, "ai_agent_query", {
      intent: result.intent,
      provider: providerName,
      cardCount: result.cards.length,
      proposedActionCount: result.proposedActions.length,
      warningCount: result.warnings.length,
    });

    return ok(res, result);
  })
);

aiRouter.get(
  "/agent/actions",
  asyncHandler(async (req, res) => {
    const actions = await prisma.aiAction.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(req.user.role === "admin" || req.user.role === "academic_manager" ? {} : { userId: req.user.id }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return ok(res, { actions: actions.map(toClientAiAction) });
  })
);

aiRouter.get(
  "/agent/actions/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const action = await prisma.aiAction.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!action) throw notFound("AI action");
    if (!canManageAiAction(req.user, action) && action.userId !== req.user.id) {
      throw new AppError(403, "FORBIDDEN", "当前账号无权查看该 AI 动作");
    }

    return ok(res, toClientAiAction(action));
  })
);

aiRouter.post(
  "/agent/actions/:id/confirm",
  validate({ params: idParamSchema, body: confirmAiActionSchema }),
  asyncHandler(async (req, res) => {
    requireAiRoles(req.user, ["admin", "academic_manager", "advisor"], "当前账号无权确认 AI 动作");
    const action = await prisma.aiAction.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!action) throw notFound("AI action");
    if (!canManageAiAction(req.user, action)) throw new AppError(403, "FORBIDDEN", "当前账号无权确认该 AI 动作");
    if (action.status !== AiActionStatus.PROPOSED) {
      throw new AppError(409, "AI_ACTION_NOT_PROPOSED", "该 AI 动作已处理，不能重复确认");
    }
    if (action.expiresAt.getTime() < Date.now()) {
      await prisma.aiAction.update({
        where: { id: action.id },
        data: { status: AiActionStatus.EXPIRED, errorMessage: "AI 动作已过期" },
      });
      throw new AppError(409, "AI_ACTION_EXPIRED", "该 AI 动作已过期，请重新生成建议");
    }

    const executionResult = buildAiActionExecutionResult(action, req.body.confirmationNote);
    const updated = await prisma.aiAction.update({
      where: { id: action.id },
      data: {
        status: AiActionStatus.EXECUTED,
        executedAt: new Date(),
        executionResult: JSON.parse(JSON.stringify(executionResult)) as Prisma.InputJsonValue,
        errorMessage: null,
      },
    });

    await logAiOperation(req, "ai_action_confirmed", {
      actionId: updated.id,
      actionType: updated.actionType,
      resultType: typeof executionResult.resultType === "string" ? executionResult.resultType : "ai_action_result",
    });

    return ok(res, {
      action: toClientAiAction(updated),
      executionResult,
      message: "AI 动作已确认，安全结果已生成",
    });
  })
);

aiRouter.post(
  "/agent/actions/:id/cancel",
  validate({ params: idParamSchema, body: cancelAiActionSchema }),
  asyncHandler(async (req, res) => {
    const action = await prisma.aiAction.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!action) throw notFound("AI action");
    if (!canManageAiAction(req.user, action) && action.userId !== req.user.id) {
      throw new AppError(403, "FORBIDDEN", "当前账号无权取消该 AI 动作");
    }
    if (action.status !== AiActionStatus.PROPOSED) {
      throw new AppError(409, "AI_ACTION_NOT_PROPOSED", "该 AI 动作已处理，不能重复取消");
    }

    const updated = await prisma.aiAction.update({
      where: { id: action.id },
      data: {
        status: AiActionStatus.CANCELLED,
        cancelledAt: new Date(),
        errorMessage: req.body.reason ?? null,
      },
    });

    await logAiOperation(req, "ai_action_cancelled", {
      actionId: updated.id,
      actionType: updated.actionType,
      reason: req.body.reason,
    });

    return ok(res, { action: toClientAiAction(updated), message: "AI 动作已取消" });
  })
);

aiRouter.post(
  "/generate-renewal-suggestion",
  validate({ body: generateRenewalSuggestionSchema }),
  asyncHandler(async (req, res) => {
    requireAiRoles(req.user, ["admin", "academic_manager", "advisor"], "当前账号无权生成续费建议");
    const { studentId, courseId, tone, includeParentMessage = true } = req.body;
    const data = await collectStudentAiData(req, studentId, courseId);
    const suggestion = buildRenewalSuggestion(data, tone);
    const result = {
      ...suggestion,
      parentMessage: includeParentMessage ? suggestion.parentMessage : "",
    };

    await logAiOperation(req, "ai_generate_renewal_suggestion", {
      studentId,
      courseId,
      riskLevel: result.riskLevel,
      source: "rule_based_real_data",
    });

    return ok(res, result);
  })
);

aiRouter.post(
  "/generate-parent-message",
  validate({ body: generateParentMessageSchema }),
  asyncHandler(async (req, res) => {
    requireAiRoles(req.user, ["admin", "academic_manager", "advisor"], "当前账号无权生成家长沟通话术");
    const { studentId, courseId, scenario, tone } = req.body;
    const data = await collectStudentAiData(req, studentId, courseId);
    const result = buildParentScenarioMessage(scenario, data, tone);

    await logAiOperation(req, "ai_generate_parent_message", {
      studentId,
      courseId,
      scenario,
      source: "rule_based_real_data",
    });

    return ok(res, result);
  })
);

aiRouter.post(
  "/polish-report",
  validate({ body: polishReportSchema }),
  asyncHandler(async (req, res) => {
    requireAiRoles(req.user, ["admin", "academic_manager", "advisor"], "当前账号无权润色家长报告");
    const { reportId, tone } = req.body;
    const report = await prisma.parentReport.findFirst({
      where: {
        id: reportId,
        organizationId: req.user.organizationId,
        ...(req.user.role === "advisor" ? { advisorId: req.user.id } : {}),
      },
      select: {
        id: true,
        studentId: true,
        title: true,
        summary: true,
        teacherFeedbackSummary: true,
        weaknessAnalysis: true,
        nextStepPlan: true,
        parentVisibleContent: true,
        periodLabel: true,
        status: true,
      },
    });
    if (!report) throw notFound("Parent report");

    const originalSummary = report.summary ?? report.parentVisibleContent ?? "";
    const polishedSummary = polishText(report.summary, `${report.title} ${report.periodLabel} 学习情况整体稳定。`, tone);
    const polishedTeacherFeedback = polishText(report.teacherFeedbackSummary, "老师反馈显示，学生近期课堂参与度和知识掌握情况需要持续跟进。", tone);
    const polishedWeakness = polishText(report.weaknessAnalysis, "建议继续关注薄弱知识点，并通过课后练习逐步巩固。", tone);
    const suggestedNextStepPlan = polishText(report.nextStepPlan, "下一阶段建议保持稳定上课节奏，结合课堂反馈安排复习和练习。", tone);
    const polishedParentVisibleContent = [
      polishedSummary,
      polishedTeacherFeedback,
      polishedWeakness,
      suggestedNextStepPlan,
    ].join("\n\n");

    const result = {
      originalSummary,
      polishedSummary,
      polishedParentVisibleContent,
      suggestedNextStepPlan,
    };

    await logAiOperation(req, "ai_polish_parent_report", {
      reportId,
      studentId: report.studentId,
      tone,
      source: "rule_based_real_data",
    });

    return ok(res, result);
  })
);

aiRouter.post(
  "/student-risk-summary",
  validate({ body: studentRiskSummarySchema }),
  asyncHandler(async (req, res) => {
    if (req.user.role === "finance") throw new AppError(403, "FORBIDDEN", "当前账号无权生成学生风险总结");
    const { studentId, periodStart, periodEnd } = req.body;
    const data = await collectStudentAiData(req, studentId, undefined, { allowTeacher: req.user.role === "teacher", periodStart, periodEnd });
    const lowCreditAccounts = data.creditAccounts.filter((account) => toNumber(account.balance) <= 5);
    const followUpLessons = data.lessons.filter((lesson) => lesson.needAdvisorFollowUp || lesson.status === "DRAFT" || lesson.status === "PENDING_FEEDBACK");
    const pendingLeaves = data.leaves.filter((leave) => leave.status === "PENDING" || leave.status === "MAKEUP_PENDING");
    const pendingReports = data.reports.filter((report) => report.status !== "SENT");

    const riskReasons = [
      ...lowCreditAccounts.map((account) => `${account.course?.name ?? "课程"} 剩余 ${toNumber(account.balance)} 课时`),
      ...followUpLessons.slice(0, 3).map((lesson) => `${shortDate(lesson.lessonDate)} ${lesson.course?.name ?? "课程"} 需要反馈或顾问跟进`),
      ...pendingLeaves.map((leave) => `${leave.course.name} 请假补课待处理`),
      ...pendingReports.map((report) => `${report.title} 尚未发送`),
    ];
    const score = lowCreditAccounts.length * 2 + followUpLessons.length + pendingLeaves.length + pendingReports.length;
    const riskLevel = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
    const evidence = {
      lowCreditAccounts: lowCreditAccounts.map((account) => ({
        course: account.course?.name ?? "未绑定课程",
        remainingHours: toNumber(account.balance),
      })),
      recentLessons: data.lessons.slice(0, 5).map((lesson) => ({
        date: shortDate(lesson.lessonDate),
        course: lesson.course?.name ?? "课程",
        status: lesson.status.toLowerCase(),
        feedback: lesson.aiSummary || lesson.performance || lesson.knowledgeMastery || lesson.topic || "",
        needAdvisorFollowUp: Boolean(lesson.needAdvisorFollowUp),
      })),
      pendingLeaveMakeupCount: pendingLeaves.length,
      pendingReportCount: pendingReports.length,
    };
    const recommendedActions = [
      lowCreditAccounts.length > 0 ? "优先确认续课规划和剩余课时提醒" : "保持常规学习节奏跟进",
      pendingLeaves.length > 0 ? "先处理未完成的请假补课申请" : "继续观察出勤和课堂反馈",
      pendingReports.length > 0 ? "补齐或发送家长报告，建立沟通依据" : "定期同步阶段反馈",
      followUpLessons.length > 0 ? "顾问跟进老师标记事项" : "暂无额外顾问介入事项",
    ];
    const advisorMessage = `建议顾问关注${data.student.name}：${riskReasons.length > 0 ? riskReasons.slice(0, 4).join("；") : "当前暂无明显风险信号"}。处理顺序建议为：先解决服务待办，再同步学习反馈，最后推进后续规划。`;

    const result = {
      riskLevel,
      riskReasons,
      evidence,
      recommendedActions,
      advisorMessage,
    };

    await logAiOperation(req, "ai_generate_student_risk_summary", {
      studentId,
      riskLevel,
      reasonCount: riskReasons.length,
      source: "rule_based_real_data",
    });

    return ok(res, result);
  })
);
