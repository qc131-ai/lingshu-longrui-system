import type {
  ReportTrendPoint,
  ReportRadarPoint,
  DashboardChartPoint,
  DashboardTask,
  ParentReport,
} from "../types";
import {
  reportTrendData,
  reportRadarData,
  dashboardChartData,
  dashboardTasks,
} from "../data";
import { dashboardKpiStats } from "../data/pageStats";
import { defaultParentReport, parentReportSummaryTemplate } from "../data/parentReport";
import { apiClient, createApiCallState } from "./apiClient";

export type ReportFilters = {
  studentId?: string;
  courseId?: string;
  advisorId?: string;
  reportType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export type GenerateReportInput = {
  studentId: string;
  courseId?: string;
  reportType?: "weekly" | "monthly" | "stage" | "custom";
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  includeLessons?: boolean;
  includeCredits?: boolean;
  includeLeaveMakeup?: boolean;
  includeHomework?: boolean;
  includeAiSummary?: boolean;
};

export type UpdateReportInput = Partial<Pick<
  ParentReport,
  "title" | "summary" | "teacherFeedbackSummary" | "weaknessAnalysis" | "nextStepPlan" | "aiSummary" | "parentVisibleContent"
>> & {
  internalNotes?: string;
};

type ApiParentReport = ParentReport;

export const reportApiState = {
  list: createApiCallState<ApiParentReport[]>(),
  generate: createApiCallState<ApiParentReport>(),
  send: createApiCallState<unknown>(),
};

function buildQuery(filters: ReportFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "undefined" && value !== "null" && value !== "Invalid Date") params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const reportService = {
  async getTrendData(): Promise<ReportTrendPoint[]> {
    return [...reportTrendData];
  },

  async getRadarData(): Promise<ReportRadarPoint[]> {
    return [...reportRadarData];
  },

  async getDashboardChart(): Promise<DashboardChartPoint[]> {
    return [...dashboardChartData];
  },

  async getDashboardTasks(): Promise<DashboardTask[]> {
    return [...dashboardTasks];
  },

  /** 获取家长报告模板数据 */
  async getParentReport(_studentId?: string): Promise<ParentReport> {
    const reports = await apiClient.requestWithFallback<ApiParentReport[]>(
      `/reports${buildQuery(_studentId ? { studentId: _studentId } : {})}`,
      { method: "GET" },
      () => [{ ...defaultParentReport }],
      reportApiState.list
    );
    return reports.find((report) => !_studentId || report.studentId === _studentId) ?? reports[0] ?? { ...defaultParentReport };
  },

  async listReports(filters: ReportFilters = {}): Promise<ParentReport[]> {
    return apiClient.request<ParentReport[]>(`/reports${buildQuery(filters)}`, { method: "GET" });
  },

  async getReport(id: string): Promise<ParentReport> {
    return apiClient.request<ParentReport>(`/reports/${id}`, { method: "GET" });
  },

  async generateReport(input: GenerateReportInput): Promise<ParentReport> {
    return apiClient.request<ParentReport>("/reports/generate", { method: "POST", body: JSON.stringify(input) });
  },

  async updateReport(id: string, input: UpdateReportInput): Promise<ParentReport> {
    return apiClient.request<ParentReport>(`/reports/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  async updateStatus(id: string, status: "draft" | "generated" | "reviewed" | "sent" | "archived"): Promise<ParentReport> {
    return apiClient.request<ParentReport>(`/reports/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  /** 生成家长报告 AI 摘要 */
  async generateParentReportSummary(_studentId?: string): Promise<string> {
    if (!_studentId) {
      const reports = await this.getParentReport();
      return ("aiSummary" in reports && typeof reports.aiSummary === "string") ? reports.aiSummary : parentReportSummaryTemplate;
    }
    const report = await apiClient.requestWithFallback<ApiParentReport>(
      "/reports/generate",
      { method: "POST", body: JSON.stringify({ studentId: _studentId, includeAiSummary: true }) },
      () => ({ ...defaultParentReport, aiSummary: parentReportSummaryTemplate }),
      reportApiState.generate
    );
    return report.aiSummary ?? parentReportSummaryTemplate;
  },

  async sendReport(reportId: string): Promise<ParentReport> {
    return apiClient.request<ParentReport>(
      `/reports/${reportId}/send`,
      { method: "POST", body: JSON.stringify({ channel: "wecom" }) }
    );
  },

  getDashboardKpiStatsSync() {
    return { ...dashboardKpiStats };
  },

  getDashboardChartSync() {
    return [...dashboardChartData];
  },

  getDashboardTasksSync() {
    return [...dashboardTasks];
  },

  getTrendDataSync() {
    return [...reportTrendData];
  },

  getRadarDataSync() {
    return [...reportRadarData];
  },

  getParentReportSync() {
    return { ...defaultParentReport };
  },
};
