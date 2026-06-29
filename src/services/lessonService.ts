import type { LessonRecord, Student } from "../types";
import { lessonRecords as seedRecords } from "../data/lessonRecords";
import { leaveRecords as seedLeaves } from "../data/leaveRecords";
import { assessments as seedAssessments } from "../data/assessments";
import { recordsPageStats, leavesPageStats } from "../data/pageStats";
import { assessmentChartData } from "../data/assessmentChart";
import { assessmentTabs, assessmentWeakPointTags } from "../data/assessmentsMeta";
import { apiClient, createApiCallState } from "./apiClient";

export type ConfirmDeductInput = {
  record: LessonRecord;
  student: Student;
  aiSummary?: string;
};

export type ConfirmDeductResult = {
  student: Student;
  record: LessonRecord;
};

export const lessonApiState = {
  records: createApiCallState<LessonRecord[]>(),
  update: createApiCallState<LessonRecord>(),
  deduct: createApiCallState<ConfirmDeductResult>(),
  leaves: createApiCallState<typeof seedLeaves>(),
};

export const lessonService = {
  async listRecords(): Promise<LessonRecord[]> {
    return apiClient.requestWithFallback<LessonRecord[]>(
      "/lesson-records",
      { method: "GET" },
      () => [...seedRecords],
      lessonApiState.records
    );
  },

  /** 确认消课：扣减课时并更新上课记录 */
  async confirmDeduct(input: ConfirmDeductInput): Promise<ConfirmDeductResult> {
    const { record, student, aiSummary } = input;
    return apiClient.requestWithFallback<ConfirmDeductResult>(
      `/lesson-records/${record.id}/deduct-credit`,
      { method: "POST", body: JSON.stringify({ aiSummary }) },
      () => ({
        student: {
          ...student,
          remainingCredits: Math.max(0, student.remainingCredits - record.creditsConsumed),
        },
        record: {
          ...record,
          status: "completed",
          feedbackStatus: "submitted",
          aiSummary: aiSummary || record.aiSummary,
        },
      }),
      lessonApiState.deduct
    );
  },

  /** 生成课堂 AI 反馈摘要 */
  async generateFeedback(record: LessonRecord): Promise<string> {
    await new Promise((r) => setTimeout(r, 500));
    return `家长您好，今天${record.studentName}同学在《${record.className}》课上表现很棒。本节课主要学习了${record.topic}，课堂专注度很高，互动积极。课后请提醒孩子完成布置的作业，我们下节课见！`;
  },

  async updateRecord(id: string, data: Partial<LessonRecord>): Promise<LessonRecord> {
    return apiClient.requestWithFallback<LessonRecord>(
      `/lesson-records/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      () => ({ ...seedRecords.find((r) => r.id === id)!, ...data }),
      lessonApiState.update
    );
  },

  async listLeaves() {
    return apiClient.requestWithFallback(
      "/leaves",
      { method: "GET" },
      () => [...seedLeaves],
      lessonApiState.leaves
    );
  },

  async listAssessments() {
    return [...seedAssessments];
  },

  async getRecordsPageStats() {
    return { ...recordsPageStats };
  },

  async getLeavesPageStats() {
    return { ...leavesPageStats };
  },

  async getAssessmentChartData() {
    return [...assessmentChartData];
  },

  async getAssessmentTabs() {
    return [...assessmentTabs];
  },

  async getAssessmentWeakPointTags() {
    return [...assessmentWeakPointTags];
  },

  getRecordsPageStatsSync() {
    return { ...recordsPageStats };
  },

  getLeavesPageStatsSync() {
    return { ...leavesPageStats };
  },

  getAssessmentChartDataSync() {
    return [...assessmentChartData];
  },

  getAssessmentTabsSync() {
    return [...assessmentTabs];
  },

  getAssessmentWeakPointTagsSync() {
    return [...assessmentWeakPointTags];
  },
};
