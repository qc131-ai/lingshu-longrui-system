import { Router } from "express";
import { CreditAdjustType, CreditTransactionStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toCreditAccount, toCreditTransaction, toNumber, toStudent } from "../lib/mappers.js";
import { validate } from "../middleware/validate.js";
import {
  adjustCreditsSchema,
  creditAccountsQuerySchema,
  creditTransactionsQuerySchema,
} from "../validators/schemas.js";
import { toPrismaEnum } from "../lib/enums.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";

export const creditsRouter = Router();

const addingTypes = new Set(["purchase", "gift", "makeup_return", "transfer_in"]);

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

function normalizeAdjustType(input: { transactionType?: string; adjustType?: string; hoursChange?: number; creditsAmount?: number }) {
  const rawType = input.transactionType ?? input.adjustType ?? "manual";
  if (rawType === "lesson_deduction") return "lesson_deduct";
  return rawType;
}

creditsRouter.get(
  "/accounts",
  validate({ query: creditAccountsQuerySchema }),
  asyncHandler(async (req, res) => {
    const lowBalanceOnly = cleanString(req.query.lowBalance) === "true";
    const accounts = await prisma.creditAccount.findMany({
      where: {
        organizationId: req.user.organizationId,
        studentId: cleanString(req.query.studentId),
        courseId: cleanString(req.query.courseId),
        OR: lowBalanceOnly ? [{ lowBalance: true }, { balance: { lte: 5 } }] : undefined,
        status: cleanString(req.query.status),
        student: req.user.role === "advisor" ? { advisorId: req.user.id } : undefined,
      },
      include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return ok(res, accounts.map(toCreditAccount));
  })
);

creditsRouter.get(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    const account = await prisma.creditAccount.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        student: req.user.role === "advisor" ? { advisorId: req.user.id } : undefined,
      },
      include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
    });
    if (!account) throw notFound("Credit account");
    return ok(res, toCreditAccount(account));
  })
);

creditsRouter.post(
  "/adjust",
  requireRoles("admin", "academic_manager", "finance"),
  validate({ body: adjustCreditsSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const adjustType = normalizeAdjustType(input);
    const hoursChange = input.hoursChange !== undefined
      ? Number(input.hoursChange)
      : (addingTypes.has(adjustType) ? Number(input.creditsAmount) : -Number(input.creditsAmount));
    if (hoursChange === 0) throw badRequest("hoursChange must not be 0");

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
    });
    if (!student || student.organizationId !== req.user.organizationId) throw notFound("Student");
    const account = await prisma.creditAccount.findFirst({
      where: {
        organizationId: req.user.organizationId,
        studentId: input.studentId,
        courseId: input.courseId,
        status: "active",
      },
      include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
    });
    if (!account) throw badRequest("未找到该学生课程的课时账户");
    const balanceBefore = toNumber(account.balance);
    const balanceAfter = balanceBefore + hoursChange;
    const lowBalance = balanceAfter <= 5;

    const result = await prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          totalPurchased: adjustType === "purchase" ? { increment: Math.abs(hoursChange) } : undefined,
          totalGifted: adjustType === "gift" ? { increment: Math.abs(hoursChange) } : undefined,
          totalConsumed: hoursChange < 0 ? { increment: Math.abs(hoursChange) } : undefined,
          lowBalance,
          version: { increment: 1 },
        },
        include: { student: { select: { id: true, name: true, grade: true, phone: true } }, course: { select: { id: true, name: true } } },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          accountId: updatedAccount.id,
          organizationId: req.user.organizationId,
          studentId: student.id,
          courseId: updatedAccount.courseId,
          adjustType: toPrismaEnum(adjustType) as CreditAdjustType,
          creditsDelta: hoursChange,
          balanceBefore,
          balanceAfter,
          amount: Number(input.amount ?? 0),
          status: CreditTransactionStatus.PAID,
          courseName: input.courseName ?? updatedAccount.course?.name,
          notes: input.note ?? input.notes,
          transactionDate: new Date(),
          createdBy: req.user.id,
        },
        include: { student: { select: { name: true } }, course: { select: { name: true } } },
      });

      const updatedStudent = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: { creditAccounts: true },
      });

      return { student: updatedStudent, account: updatedAccount, transaction };
    });

    await safeLogOperation(req, {
      action: "adjust_credit",
      resourceType: "credit_transaction",
      resourceId: result.transaction.id,
      detail: { studentId: student.id, courseId: result.account.courseId, transactionType: adjustType, hoursChange, balanceBefore, balanceAfter },
    });
    await safeLogOperation(req, {
      action: "create_credit_transaction",
      resourceType: "credit_transaction",
      resourceId: result.transaction.id,
      detail: { transactionType: adjustType, hoursChange },
    });

    return created(res, {
      student: toStudent(result.student),
      creditAccount: toCreditAccount(result.account),
      transaction: toCreditTransaction(result.transaction),
    });
  })
);

creditsRouter.get(
  "/transactions",
  validate({ query: creditTransactionsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query;
    const where: Prisma.CreditTransactionWhereInput = {};
    where.organizationId = req.user.organizationId;
    if (req.user.role === "advisor") where.student = { advisorId: req.user.id };
    const transactionType = cleanString(query.transactionType);
    if (query.studentId) where.studentId = query.studentId as string;
    if (query.courseId) where.courseId = query.courseId as string;
    if (transactionType) where.adjustType = toPrismaEnum(transactionType === "lesson_deduction" ? "lesson_deduct" : transactionType) as CreditAdjustType;
    if (query.status) where.status = toPrismaEnum(query.status as string) as CreditTransactionStatus;
    const startDate = cleanString(query.startDate) ?? cleanString(query.dateFrom);
    const endDate = cleanString(query.endDate) ?? cleanString(query.dateTo);
    if (startDate || endDate) {
      where.transactionDate = {
        gte: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
        lte: endDate ? new Date(`${endDate}T00:00:00.000Z`) : undefined,
      };
    }

    const transactions = await prisma.creditTransaction.findMany({
      where,
      include: { student: { select: { name: true } }, course: { select: { name: true } }, account: true },
      orderBy: { transactionDate: "desc" },
    });
    return ok(res, transactions.map(toCreditTransaction));
  })
);
