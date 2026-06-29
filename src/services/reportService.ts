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

type ApiParentReport = ParentReport & { id?: string; studentId?: string; status?: string; aiSummary?: string };

export const reportApiState = {
  list: createApiCallState<ApiParentReport[]>(),
  generate: createApiCallState<ApiParentReport>(),
  send: createApiCallState<unknown>(),
};

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
      "/reports",
      { method: "GET" },
      () => [{ ...defaultParentReport }],
      reportApiState.list
    );
    return reports.find((report) => !_studentId || report.studentId === _studentId) ?? reports[0] ?? { ...defaultParentReport };
  },

  /** 生成家长报告 AI 摘要 */
  async generateParentReportSummary(_studentId?: string): Promise<string> {
    if (!_studentId) {
      const reports = await this.getParentReport();
      return ("aiSummary" in reports && typeof reports.aiSummary === "string") ? reports.aiSummary : parentReportSummaryTemplate;
    }
    const report = await apiClient.requestWithFallback<ApiParentReport>(
      "/reports/generate",
      { method: "POST", body: JSON.stringify({ studentId: _studentId }) },
      () => ({ ...defaultParentReport, aiSummary: parentReportSummaryTemplate }),
      reportApiState.generate
    );
    return report.aiSummary ?? parentReportSummaryTemplate;
  },

  async sendReport(reportId: string): Promise<void> {
    await apiClient.requestWithFallback(
      `/reports/${reportId}/send`,
      { method: "POST", body: JSON.stringify({ channel: "wecom" }) },
      () => ({ success: true }),
      reportApiState.send
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
