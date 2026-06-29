import type { RenewalSuggestion } from "../types";

export const creditLedgerSummary = {
  totalRemainingHours: 1450,
  monthlyConsumedHours: 320,
};

export const ordersPageStats = {
  monthlyNewOrders: 12,
  monthlyRevenue: 128500,
  pendingOrders: 3,
  warningStudents: 8,
};

export const defaultRenewalSuggestion: RenewalSuggestion = {
  name: "赵诗琪",
  course: "AMC10 冲刺班",
  credits: 2,
  progress: "已完成 80%",
  risk: "距离考试还有 2 个月，剩余课时不足以覆盖冲刺阶段。",
  script:
    "家长您好，诗琪最近的AMC10模考成绩提升明显。目前冲刺班还剩2课时，为了保证考前冲刺阶段的连贯性，建议本周为您续报10课时专项冲刺包，您看可以吗？",
};
