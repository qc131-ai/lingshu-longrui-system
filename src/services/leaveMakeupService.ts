import type { LeaveRecord } from "../types";
import { apiClient, createApiCallState } from "./apiClient";

export type LeaveMakeupFilters = {
  studentId?: string;
  teacherId?: string;
  courseId?: string;
  classId?: string;
  requestType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export type CreateLeaveMakeupInput = {
  scheduleId: string;
  lessonRecordId?: string;
  requestType: "student_leave" | "teacher_leave" | "reschedule" | "cancellation" | "makeup";
  reason: string;
  deductCredit?: boolean;
  needMakeup?: boolean;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
};

export type ScheduleMakeupInput = {
  date: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  classroom?: string;
  lessonType?: "class" | "exam" | "meeting";
  notes?: string;
};

export const leaveMakeupApiState = {
  list: createApiCallState<LeaveRecord[]>(),
  update: createApiCallState<LeaveRecord>(),
};

function buildQuery(filters: LeaveMakeupFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "undefined" && value !== "null" && value !== "Invalid Date") params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const leaveMakeupService = {
  async list(filters: LeaveMakeupFilters = {}) {
    return apiClient.request<LeaveRecord[]>(`/leave-makeup${buildQuery(filters)}`, { method: "GET" });
  },

  async get(id: string) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}`, { method: "GET" });
  },

  async create(input: CreateLeaveMakeupInput) {
    return apiClient.request<LeaveRecord>("/leave-makeup", { method: "POST", body: JSON.stringify(input) });
  },

  async update(id: string, input: Partial<CreateLeaveMakeupInput & { status: string }>) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  async updateStatus(id: string, input: { status: string; approvalNote?: string; rejectReason?: string }) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}/status`, { method: "PATCH", body: JSON.stringify(input) });
  },

  async approve(id: string, approvalNote?: string) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}/approve`, { method: "POST", body: JSON.stringify({ approvalNote }) });
  },

  async reject(id: string, rejectReason: string) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}/reject`, { method: "POST", body: JSON.stringify({ rejectReason }) });
  },

  async scheduleMakeup(id: string, input: ScheduleMakeupInput) {
    return apiClient.request<{ request: LeaveRecord }>(`/leave-makeup/${id}/schedule-makeup`, { method: "POST", body: JSON.stringify(input) });
  },

  async notifyParent(id: string, message?: string) {
    return apiClient.request<LeaveRecord>(`/leave-makeup/${id}/notify-parent`, { method: "POST", body: JSON.stringify({ message }) });
  },
};
