import type { LessonRecord, LessonRecordStatus, Student } from "../types";
import { lessonRecords as seedRecords } from "../data/lessonRecords";
import { leaveRecords as seedLeaves } from "../data/leaveRecords";
import { assessments as seedAssessments } from "../data/assessments";
import { recordsPageStats, leavesPageStats } from "../data/pageStats";
import { assessmentChartData } from "../data/assessmentChart";
import { assessmentTabs, assessmentWeakPointTags } from "../data/assessmentsMeta";
import { ApiClientError, apiClient, createApiCallState, setApiError, setApiLoading, setApiSuccess } from "./apiClient";

export type ConfirmDeductInput = {
  record: LessonRecord;
  student: Student;
  aiSummary?: string;
};

export type ConfirmDeductResult = {
  student: Student;
  record: LessonRecord;
};

export type ConfirmDeductionResult = {
  lessonRecord: LessonRecord;
  creditAccount: {
    id: string;
    studentId: string;
    courseId?: string;
    remainingHours: number;
    totalConsumedHours: number;
    lowBalance: boolean;
    status: string;
  };
  creditTransaction: import("../types").CreditTransaction;
};

export type LessonRecordFilters = {
  startDate?: string | null;
  endDate?: string | null;
  teacherId?: string | null;
  courseId?: string | null;
  status?: LessonRecordStatus | "" | null;
  search?: string | null;
};

export type LessonFeedbackInput = Partial<Pick<
  LessonRecord,
  "topic" | "performance" | "knowledgeMastery" | "homework" | "nextPlan" | "internalNotes" | "aiSummary" | "needAdvisorFollowUp" | "syncToParent"
>> & {
  status?: LessonRecordStatus;
  feedbackStatus?: "submitted" | "pending";
};

export const lessonApiState = {
  records: createApiCallState<LessonRecord[]>(),
  update: createApiCallState<LessonRecord>(),
  deduct: createApiCallState<ConfirmDeductResult>(),
  leaves: createApiCallState<typeof seedLeaves>(),
};

function appendQueryParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") return;
  if (value === "undefined" || value === "null" || value === "Invalid Date") return;
  params.set(key, value);
}

function buildLessonQuery(filters: LessonRecordFilters = {}) {
  const params = new URLSearchParams();
  appendQueryParam(params, "startDate", filters.startDate ?? undefined);
  appendQueryParam(params, "endDate", filters.endDate ?? undefined);
  appendQueryParam(params, "teacherId", filters.teacherId ?? undefined);
  appendQueryParam(params, "courseId", filters.courseId ?? undefined);
  appendQueryParam(params, "status", filters.status ?? undefined);
  appendQueryParam(params, "search", filters.search ?? undefined);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatApiError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const endpoint = `${error.method ?? "GET"} ${error.url ?? ""}`.trim();
    return `${endpoint}：${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
}

export const lessonService = {
  async listRecords(filters: LessonRecordFilters = {}): Promise<LessonRecord[]> {
    setApiLoading(lessonApiState.records);
    try {
      const records = await apiClient.request<LessonRecord[]>(
        `/lesson-records${buildLessonQuery(filters)}`,
        { method: "GET" }
      );
      setApiSuccess(lessonApiState.records, records);
      return records;
    } catch (error) {
      const message = formatApiError(error, "上课记录查询失败");
      setApiError(lessonApiState.records, message);
      throw new Error(message);
    }
  },

  async createFromSchedule(scheduleId: string): Promise<LessonRecord> {
    return apiClient.request<LessonRecord>(`/lesson-records/from-schedule/${scheduleId}`, { method: "POST" });
  },

  async saveDraft(id: string, data: LessonFeedbackInput): Promise<LessonRecord> {
    return this.updateRecord(id, {
      ...data,
      status: data.status ?? "draft",
      feedbackStatus: "pending",
    });
  },

  async submitFeedback(id: string, data: LessonFeedbackInput): Promise<LessonRecord> {
    const updated = await this.updateRecord(id, {
      ...data,
      status: "submitted",
      feedbackStatus: "submitted",
    });
    return apiClient.request<LessonRecord>(
      `/lesson-records/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "submitted", aiSummary: updated.aiSummary }) }
    );
  },

  async confirmDeduction(id: string, input: { consumedHours: number; deductionNote?: string; syncToParent?: boolean }): Promise<ConfirmDeductionResult> {
    return apiClient.request<ConfirmDeductionResult>(
      `/lesson-records/${id}/confirm-deduction`,
      { method: "POST", body: JSON.stringify(input) }
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
    const learner = record.studentName || record.className || "同学";
    const course = record.courseName || record.className || "课程";
    return `家长您好，今天${learner}在《${course}》课上完成了${record.topic || "本节课目标内容"}。课堂表现方面，${record.performance || "整体专注度较好，能够跟随老师节奏参与互动"}。知识点掌握方面，${record.knowledgeMastery || "核心知识点已基本理解，建议通过课后练习继续巩固"}。课后请完成：${record.homework || "老师布置的相关练习"}。下节课将继续推进${record.nextPlan || "后续重点内容"}。`;
  },

  async updateRecord(id: string, data: Partial<LessonRecord>): Promise<LessonRecord> {
    setApiLoading(lessonApiState.update);
    try {
      const record = await apiClient.request<LessonRecord>(
        `/lesson-records/${id}`,
        { method: "PUT", body: JSON.stringify(data) }
      );
      setApiSuccess(lessonApiState.update, record);
      return record;
    } catch (error) {
      const message = formatApiError(error, "上课记录更新失败");
      setApiError(lessonApiState.update, message);
      throw new Error(message);
    }
  },

  async listLeaves() {
    return apiClient.requestWithFallback(
      "/leave-makeup",
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
