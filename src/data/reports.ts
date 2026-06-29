import type { ReportTrendPoint, ReportRadarPoint } from "../types";

export const reportTrendData: ReportTrendPoint[] = [
  { name: "第1周", score: 75 },
  { name: "第2周", score: 82 },
  { name: "第3周", score: 80 },
  { name: "第4周", score: 88 },
  { name: "第5周", score: 92 },
];

export const reportRadarData: ReportRadarPoint[] = [
  { subject: "听力", A: 90, fullMark: 100 },
  { subject: "口语", A: 85, fullMark: 100 },
  { subject: "阅读", A: 95, fullMark: 100 },
  { subject: "写作", A: 78, fullMark: 100 },
  { subject: "词汇", A: 88, fullMark: 100 },
];
