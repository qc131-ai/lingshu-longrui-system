import type { ReactNode } from "react";
import type { Student } from "./student";

export type AIChatHistoryItem = {
  id: number;
  title: string;
  date: string;
};

export type AIMessage = {
  role: "user" | "ai";
  content: string | ReactNode;
};

export type AIQueryIntent = "credit_warning" | "report" | "makeup" | "default";

export type RenewalSuggestion = {
  name: string;
  course: string;
  credits: number;
  progress: string;
  risk: string;
  script: string;
};

export type CreditWarningResult = {
  intent: "credit_warning";
  students: Student[];
};

export type MakeupReminderResult = {
  intent: "makeup";
  items: string[];
  count: number;
};

export type AIQueryResult =
  | CreditWarningResult
  | MakeupReminderResult
  | { intent: "report" }
  | { intent: "default"; fallbackText: string };
