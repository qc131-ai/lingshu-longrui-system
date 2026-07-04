import type { Course, Class } from "../types";
import { courses as seedCourses } from "../data/courses";
import { classes as seedClasses } from "../data/classes";
import { generateId } from "./config";
import { apiClient, createApiCallState } from "./apiClient";

export const courseApiState = {
  list: createApiCallState<Course[]>(),
  create: createApiCallState<Course>(),
  detail: createApiCallState<Course | null>(),
  update: createApiCallState<Course>(),
  delete: createApiCallState<Course>(),
  classes: createApiCallState<Class[]>(),
  createClass: createApiCallState<Class>(),
  classDetail: createApiCallState<Class | null>(),
  updateClass: createApiCallState<Class>(),
  deleteClass: createApiCallState<Class>(),
};

export const courseService = {
  async list(filters?: { category?: string; teachingMode?: string; status?: string }): Promise<Course[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.teachingMode) params.set("teachingMode", filters.teachingMode);
    if (filters?.status) params.set("status", filters.status);
    return apiClient.request<Course[]>(`/courses${params.toString() ? `?${params.toString()}` : ""}`, { method: "GET" });
  },

  async listClasses(): Promise<Class[]> {
    return apiClient.request<Class[]>("/classes", { method: "GET" });
  },

  async createCourse(data: Omit<Course, "id">): Promise<Course> {
    return apiClient.requestWithFallback<Course>(
      "/courses",
      { method: "POST", body: JSON.stringify(data) },
      () => ({ ...data, id: generateId("C") }),
      courseApiState.create
    );
  },

  async getCourse(id: string): Promise<Course | null> {
    return apiClient.requestWithFallback<Course | null>(
      `/courses/${id}`,
      { method: "GET" },
      () => seedCourses.find((course) => course.id === id) ?? null,
      courseApiState.detail
    );
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<Course> {
    return apiClient.requestWithFallback<Course>(
      `/courses/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      () => ({ ...seedCourses.find((course) => course.id === id)!, ...data }),
      courseApiState.update
    );
  },

  async deleteCourse(id: string): Promise<Course> {
    return apiClient.requestWithFallback<Course>(
      `/courses/${id}`,
      { method: "DELETE" },
      () => ({ ...seedCourses.find((course) => course.id === id)!, status: "archived" }),
      courseApiState.delete
    );
  },

  async createClass(data: Omit<Class, "id">): Promise<Class> {
    return apiClient.requestWithFallback<Class>(
      "/classes",
      { method: "POST", body: JSON.stringify({
        name: data.name,
        courseId: data.courseId,
        teacherId: data.teacherId,
        scheduleDesc: data.schedule,
        capacity: data.capacity,
        enrolledCount: data.enrolled,
        classroom: data.classroom,
      }) },
      () => ({ ...data, id: generateId("CLS") }),
      courseApiState.createClass
    );
  },

  async getClass(id: string): Promise<Class | null> {
    return apiClient.requestWithFallback<Class | null>(
      `/classes/${id}`,
      { method: "GET" },
      () => seedClasses.find((item) => item.id === id) ?? null,
      courseApiState.classDetail
    );
  },

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    return apiClient.requestWithFallback<Class>(
      `/classes/${id}`,
      { method: "PUT", body: JSON.stringify({
        name: data.name,
        courseId: data.courseId,
        teacherId: data.teacherId,
        scheduleDesc: data.schedule,
        capacity: data.capacity,
        enrolledCount: data.enrolled,
        classroom: data.classroom,
        status: data.status,
        studentIds: data.studentIds,
      }) },
      () => ({ ...seedClasses.find((item) => item.id === id)!, ...data }),
      courseApiState.updateClass
    );
  },

  async deleteClass(id: string): Promise<Class> {
    return apiClient.requestWithFallback<Class>(
      `/classes/${id}`,
      { method: "DELETE" },
      () => ({ ...seedClasses.find((item) => item.id === id)!, status: "archived" }),
      courseApiState.deleteClass
    );
  },

  async addClassStudent(classId: string, studentId: string): Promise<Class> {
    return apiClient.requestWithFallback<Class>(
      `/classes/${classId}/students`,
      { method: "POST", body: JSON.stringify({ studentId }) },
      () => seedClasses.find((item) => item.id === classId)!,
      courseApiState.updateClass
    );
  },

  async removeClassStudent(classId: string, studentId: string): Promise<Class> {
    return apiClient.requestWithFallback<Class>(
      `/classes/${classId}/students/${studentId}`,
      { method: "DELETE" },
      () => seedClasses.find((item) => item.id === classId)!,
      courseApiState.updateClass
    );
  },
};
