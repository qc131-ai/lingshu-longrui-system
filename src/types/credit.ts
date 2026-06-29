export type CreditTransaction = {
  id: string;
  studentId: string;
  studentName: string;
  courseName: string;
  amount: number;
  creditsAdded: number;
  creditsConsumed: number;
  date: string;
  status: "paid" | "pending" | "refunded";
  expireDate?: string;
};

/** @deprecated 使用 CreditTransaction */
export type Order = CreditTransaction;
