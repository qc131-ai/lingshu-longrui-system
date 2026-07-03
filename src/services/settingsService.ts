import { apiClient } from "./apiClient";

export type SystemSettings = {
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  shortName: string;
  phone: string;
  email: string;
  address: string;
  logoText: string;
  version: string;
  environment: "local" | "staging" | "production";
  academicConfig: {
    lowCreditThreshold: number;
    defaultLessonHours: number;
    allowCreditOverdraft: boolean;
    enableConflictDetection: boolean;
    enableLeaveApproval: boolean;
    enableReportReview: boolean;
  };
  notificationConfig: {
    enableParentNotification: boolean;
    enableTeacherReminder: boolean;
    enableAdvisorRenewalReminder: boolean;
    channels: Array<"wecom" | "email" | "sms">;
  };
  aiConfig: {
    mode: "rule_based" | "mock";
    enableAssistant: boolean;
    enableRenewalSuggestion: boolean;
    enableReportPolish: boolean;
    apiKeyStatus: string;
  };
  updatedAt: string;
};

export type ManagedUser = {
  id: string;
  displayName: string;
  email: string;
  role: "admin" | "academic_manager" | "advisor" | "teacher" | "finance";
  status: "active" | "disabled";
  organizationName: string;
  teacherId?: string;
  teacherName?: string;
  advisorStudentCount: number;
  lastLoginAt?: string;
  createdAt: string;
};

export type PermissionMatrix = {
  roles: string[];
  actions: string[];
  modules: Array<{
    module: string;
    permissions: Record<string, Record<string, boolean>>;
  }>;
};

export const settingsService = {
  getSettings() {
    return apiClient.request<SystemSettings>("/settings");
  },
  updateSettings(input: Partial<SystemSettings>) {
    return apiClient.request<SystemSettings>("/settings", { method: "PUT", body: JSON.stringify(input) });
  },
  listUsers() {
    return apiClient.request<ManagedUser[]>("/settings/users");
  },
  createUser(input: { displayName: string; email: string; password: string; role: ManagedUser["role"]; status?: ManagedUser["status"]; teacherId?: string }) {
    return apiClient.request<ManagedUser>("/settings/users", { method: "POST", body: JSON.stringify(input) });
  },
  updateUser(id: string, input: Partial<Pick<ManagedUser, "displayName" | "role" | "status" | "teacherId">>) {
    return apiClient.request<ManagedUser>(`/settings/users/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  updateUserStatus(id: string, status: ManagedUser["status"]) {
    return apiClient.request<ManagedUser>(`/settings/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  resetPassword(id: string, password: string) {
    return apiClient.request<ManagedUser>(`/settings/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
  },
  getPermissions() {
    return apiClient.request<PermissionMatrix>("/settings/permissions");
  },
};
