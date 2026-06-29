import { Router } from "express";
import { CreditAdjustType, CreditTransactionStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toCreditTransaction, toNumber, toStudent } from "../lib/mappers.js";
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

creditsRouter.get(
  "/accounts",
  validate({ query: creditAccountsQuerySchema }),
  asyncHandler(async (req, res) => {
    const accounts = await prisma.creditAccount.findMany({
      where: {
        organizationId: req.user.organizationId,
        studentId: req.query.studentId ? (req.query.studentId as string) : undefined,
        student: req.user.role === "advisor" ? { advisorId: req.user.id } : undefined,
      },
      include: { student: { select: { id: true, name: true, grade: true, phone: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return ok(
      res,
      accounts.map((account) => ({
        id: account.id,
        studentId: account.studentId,
        student: account.student,
        balance: toNumber(account.balance),
        totalPurchased: toNumber(account.totalPurchased),
        totalConsumed: toNumber(account.totalConsumed),
        totalGifted: toNumber(account.totalGifted),
        updatedAt: account.updatedAt,
      }))
    );
  })
);

creditsRouter.post(
  "/adjust",
  requireRoles("admin", "academic_manager", "finance"),
  validate({ body: adjustCreditsSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body;
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { creditAccount: true },
    });
    if (!student || student.organizationId !== req.user.organizationId) throw notFound("Student");
    if (req.user.role === "advisor" && student.advisorId !== req.user.id) throw notFound("Student");
    if (!student.creditAccount) throw badRequest("Student credit account is missing");

    const isAdding = addingTypes.has(input.adjustType);
    const amount = Number(input.creditsAmount);
    const delta = isAdding ? amount : -amount;

    const result = await prisma.$transaction(async (tx) => {
      const currentBalance = toNumber(student.creditAccount!.balance);
      const newBalance = Math.max(0, currentBalance + delta);
      const account = await tx.creditAccount.update({
        where: { id: student.creditAccount!.id },
        data: {
          balance: newBalance,
          totalPurchased: input.adjustType === "purchase" ? { increment: amount } : undefined,
          totalGifted: input.adjustType === "gift" ? { increment: amount } : undefined,
          totalConsumed: !isAdding ? { increment: amount } : undefined,
          version: { increment: 1 },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          accountId: account.id,
          organizationId: req.user.organizationId,
          studentId: student.id,
          courseId: input.courseId,
          adjustType: toPrismaEnum(input.adjustType) as CreditAdjustType,
          creditsDelta: delta,
          balanceAfter: newBalance,
          amount: Number(input.amount ?? 0),
          status: CreditTransactionStatus.PAID,
          courseName: input.courseName,
          notes: input.notes,
          transactionDate: new Date(),
        },
        include: { student: { select: { name: true } }, course: { select: { name: true } } },
      });

      const updatedStudent = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: { creditAccount: true },
      });

      return { student: updatedStudent, transaction };
    });

    await logOperation(req, {
      action: "adjust_credit",
      resourceType: "credit_transaction",
      resourceId: result.transaction.id,
      detail: { studentId: student.id, adjustType: input.adjustType, creditsAmount: input.creditsAmount },
    });

    return created(res, {
      student: toStudent(result.student),
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
    if (query.studentId) where.studentId = query.studentId as string;
    if (query.status) where.status = toPrismaEnum(query.status as string) as CreditTransactionStatus;
    if (query.dateFrom || query.dateTo) {
      where.transactionDate = {
        gte: query.dateFrom ? new Date(`${query.dateFrom}T00:00:00.000Z`) : undefined,
        lte: query.dateTo ? new Date(`${query.dateTo}T00:00:00.000Z`) : undefined,
      };
    }

    const transactions = await prisma.creditTransaction.findMany({
      where,
      include: { student: { select: { name: true } }, course: { select: { name: true } } },
      orderBy: { transactionDate: "desc" },
    });
    return ok(res, transactions.map(toCreditTransaction));
  })
);
