import type { CreditTransaction, Student } from "../types";
import { creditTransactions as seedTransactions } from "../data/creditTransactions";
import { creditLedgerSummary, ordersPageStats, financePageStats } from "../data";
import { apiClient, createApiCallState } from "./apiClient";

export type AdjustCreditsInput = {
  student: Student;
  adjustType: string;
  creditsAmount: number;
  courseName?: string;
  amount?: number;
  notes?: string;
};

export type AdjustCreditsResult = {
  student: Student;
  transaction: CreditTransaction;
};

const ADDING_TYPES = ["purchase", "gift", "makeup_return", "transfer_in"];

export const creditApiState = {
  transactions: createApiCallState<CreditTransaction[]>(),
  adjust: createApiCallState<AdjustCreditsResult>(),
};

export const creditService = {
  async listTransactions(): Promise<CreditTransaction[]> {
    return apiClient.requestWithFallback<CreditTransaction[]>(
      "/credits/transactions",
      { method: "GET" },
      () => [...seedTransactions],
      creditApiState.transactions
    );
  },

  /** 课时调整 */
  async adjustCredits(input: AdjustCreditsInput): Promise<AdjustCreditsResult> {
    const { student, adjustType, creditsAmount, courseName, amount } = input;
    const isAdding = ADDING_TYPES.includes(adjustType);
    const delta = Number(creditsAmount);

    return apiClient.requestWithFallback<AdjustCreditsResult>(
      "/credits/adjust",
      {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          adjustType,
          creditsAmount,
          courseName,
          amount,
          notes: input.notes,
        }),
      },
      () => {
        const newCredits = isAdding
          ? student.remainingCredits + delta
          : Math.max(0, student.remainingCredits - delta);

        const transaction: CreditTransaction = {
          id: `O${Date.now()}`,
          studentId: student.id,
          studentName: student.name,
          courseName: courseName || "课时调整",
          amount: amount || 0,
          creditsAdded: isAdding ? delta : -delta,
          creditsConsumed: 0,
          date: new Date().toISOString().split("T")[0],
          status: "paid",
        };

        return {
          student: { ...student, remainingCredits: newCredits },
          transaction,
        };
      },
      creditApiState.adjust
    );
  },

  async getOrdersPageStats() {
    return { ...ordersPageStats };
  },

  async getLedgerSummary() {
    return { ...creditLedgerSummary };
  },

  async getFinancePageStats() {
    return { ...financePageStats };
  },

  getOrdersPageStatsSync() {
    return { ...ordersPageStats };
  },

  getLedgerSummarySync() {
    return { ...creditLedgerSummary };
  },

  getFinancePageStatsSync() {
    return { ...financePageStats };
  },
};
