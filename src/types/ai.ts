import type { ReactNode } from "react";

export type AIChatHistoryItem = {
  id: number;
  title: string;
  date: string;
};

export type AIMessage = {
  role: "user" | "ai";
  content: string | ReactNode;
};

export type AIQueryIntent =
  | "low_credit_students"
  | "missing_teacher_feedback"
  | "academic_todo"
  | "leave_makeup_pending"
  | "parent_report_pending"
  | "student_risk"
  | "unknown";

export type AICardAction = {
  label: string;
  type: "navigate" | "toast" | "mock" | "generate";
  target?: string;
  message?: string;
  payload?: Record<string, unknown>;
};

export type AICard = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  priority?: "high" | "medium" | "low";
  fields: Array<{ label: string; value: string | number }>;
  actions: AICardAction[];
  data?: Record<string, unknown>;
};

export type AIQueryResult = {
  answer: string;
  intent: AIQueryIntent;
  cards: AICard[];
  actions: AICardAction[];
  relatedData?: Record<string, unknown>;
};

export type RenewalSuggestion = {
  name?: string;
  course?: string;
  credits?: number;
  progress?: string;
  risk?: string;
  script?: string;
  studentSummary: string;
  creditSummary: string;
  riskLevel: "low" | "medium" | "high";
  renewalSuggestion: string;
  parentMessage: string;
  advisorTalkingPoints: string[];
  nextActions: string[];
};

export type ParentMessageScenario =
  | "low_credit_reminder"
  | "progress_update"
  | "makeup_notice"
  | "renewal_followup"
  | "report_delivery"
  | "risk_followup";

export type ParentMessageResult = {
  title: string;
  message: string;
  keyPoints: string[];
  suggestedSendChannel: string;
  cautionNotes: string[];
};

export type PolishReportResult = {
  originalSummary: string;
  polishedSummary: string;
  polishedParentVisibleContent: string;
  suggestedNextStepPlan: string;
};

export type StudentRiskSummaryResult = {
  riskLevel: "low" | "medium" | "high";
  riskReasons: string[];
  evidence: Record<string, unknown>;
  recommendedActions: string[];
  advisorMessage: string;
};

export type AIGenerationResult =
  | ({ kind: "renewal_suggestion"; title: string } & RenewalSuggestion)
  | ({ kind: "parent_message" } & ParentMessageResult)
  | ({ kind: "polish_report"; title: string } & PolishReportResult)
  | ({ kind: "student_risk_summary"; title: string } & StudentRiskSummaryResult);
