export type CreditTransaction = {
  id: string;
  studentId: string;
  studentName: string;
  courseId?: string;
  courseName: string;
  lessonRecordId?: string;
  creditAccountId?: string;
  transactionType?: string;
  hoursChange?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  operatorId?: string;
  note?: string;
  amount: number;
  creditsAdded: number;
  creditsConsumed: number;
  date: string;
  status: "paid" | "pending" | "refunded";
  expireDate?: string;
  createdAt?: string;
};

export type CreditAccount = {
  id: string;
  studentId: string;
  studentName?: string;
  courseId?: string;
  courseName?: string;
  totalPurchasedHours: number;
  totalConsumedHours: number;
  remainingHours: number;
  giftedHours: number;
  frozenHours: number;
  lowBalance: boolean;
  status: string;
  balance?: number;
  updatedAt?: string;
};

/** @deprecated 使用 CreditTransaction */
export type Order = CreditTransaction;
