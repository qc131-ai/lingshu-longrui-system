import type { Teacher } from "../types";
import { teachers as seedTeachers } from "../data/teachers";
import { apiClient, createApiCallState } from "./apiClient";

export const teacherApiState = {
  list: createApiCallState<Teacher[]>(),
  detail: createApiCallState<Teacher | null>(),
  create: createApiCallState<Teacher>(),
  update: createApiCallState<Teacher>(),
  delete: createApiCallState<Teacher>(),
};

export const teacherService = {
  async list(): Promise<Teacher[]> {
    return apiClient.request<Teacher[]>("/teachers", { method: "GET" });
  },

  async getTeacher(id: string): Promise<Teacher | null> {
    return apiClient.requestWithFallback<Teacher | null>(
      `/teachers/${id}`,
      { method: "GET" },
      () => seedTeachers.find((teacher) => teacher.id === id) ?? null,
      teacherApiState.detail
    );
  },

  async createTeacher(data: Omit<Teacher, "id">): Promise<Teacher> {
    return apiClient.requestWithFallback<Teacher>(
      "/teachers",
      { method: "POST", body: JSON.stringify(data) },
      () => ({ ...data, id: `T${Date.now()}` }),
      teacherApiState.create
    );
  },

  async updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher> {
    return apiClient.requestWithFallback<Teacher>(
      `/teachers/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      () => ({ ...seedTeachers.find((teacher) => teacher.id === id)!, ...data }),
      teacherApiState.update
    );
  },

  async deleteTeacher(id: string): Promise<Teacher> {
    return apiClient.requestWithFallback<Teacher>(
      `/teachers/${id}`,
      { method: "DELETE" },
      () => ({ ...seedTeachers.find((teacher) => teacher.id === id)!, status: "archived" }),
      teacherApiState.delete
    );
  },
};
