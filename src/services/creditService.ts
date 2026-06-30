import type { CreditAccount, CreditTransaction, Student } from "../types";
import { creditTransactions as seedTransactions } from "../data/creditTransactions";
import { creditLedgerSummary, ordersPageStats, financePageStats } from "../data";
import { apiClient, createApiCallState } from "./apiClient";

export type AdjustCreditsInput = {
  student: Student;
  courseId?: string;
  adjustType: string;
  creditsAmount: number;
  hoursChange?: number;
  courseName?: string;
  amount?: number;
  notes?: string;
};

export type AdjustCreditsResult = {
  student: Student;
  creditAccount?: CreditAccount;
  transaction: CreditTransaction;
};

const ADDING_TYPES = ["purchase", "gift", "makeup_return", "transfer_in"];

export const creditApiState = {
  accounts: createApiCallState<CreditAccount[]>(),
  transactions: createApiCallState<CreditTransaction[]>(),
  adjust: createApiCallState<AdjustCreditsResult>(),
};

export const creditService = {
  async listAccounts(filters: { studentId?: string; courseId?: string; lowBalance?: boolean; status?: string } = {}): Promise<CreditAccount[]> {
    const params = new URLSearchParams();
    if (filters.studentId) params.set("studentId", filters.studentId);
    if (filters.courseId) params.set("courseId", filters.courseId);
    if (filters.lowBalance !== undefined) params.set("lowBalance", String(filters.lowBalance));
    if (filters.status) params.set("status", filters.status);
    const query = params.toString();
    return apiClient.requestWithFallback<CreditAccount[]>(
      `/credits/accounts${query ? `?${query}` : ""}`,
      { method: "GET" },
      () => [],
      creditApiState.accounts
    );
  },

  async listTransactions(filters: { studentId?: string; courseId?: string; transactionType?: string; startDate?: string; endDate?: string } = {}): Promise<CreditTransaction[]> {
    const params = new URLSearchParams();
    if (filters.studentId) params.set("studentId", filters.studentId);
    if (filters.courseId) params.set("courseId", filters.courseId);
    if (filters.transactionType) params.set("transactionType", filters.transactionType);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    const query = params.toString();
    return apiClient.requestWithFallback<CreditTransaction[]>(
      `/credits/transactions${query ? `?${query}` : ""}`,
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
          courseId: input.courseId,
          adjustType,
          transactionType: adjustType,
          creditsAmount,
          hoursChange: input.hoursChange,
          courseName,
          amount,
          note: input.notes,
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
