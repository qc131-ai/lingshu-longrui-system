import type { CreditTransaction } from "../types";

export const creditTransactions: CreditTransaction[] = [
  { id: "O001", studentId: "S001", studentName: "张子涵", courseName: "AP微积分BC保5分班", amount: 15000, creditsAdded: 30, creditsConsumed: 10, date: "2024-03-01", status: "paid" },
  { id: "O002", studentId: "S002", studentName: "李佳怡", courseName: "AMC 10 冲刺营", amount: 12000, creditsAdded: 20, creditsConsumed: 15, date: "2024-03-10", status: "paid" },
  { id: "O003", studentId: "S003", studentName: "王宇航", courseName: "托福核心词汇突破", amount: 8000, creditsAdded: 15, creditsConsumed: 3, date: "2024-03-15", status: "pending" },
];

/** @deprecated 使用 creditTransactions */
export const mockOrders = creditTransactions;
