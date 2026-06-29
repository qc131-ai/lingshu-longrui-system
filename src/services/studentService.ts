import type { Student, StudentDetail } from "../types";
import { students as seedStudents } from "../data/students";
import { availableStudentTags, gradeOptions, studentDetailDefaults } from "../data/studentMeta";
import { generateId } from "./config";
import { apiClient, createApiCallState } from "./apiClient";

export type CreateStudentInput = Omit<Student, "id">;

export const studentApiState = {
  list: createApiCallState<Student[]>(),
  create: createApiCallState<Student>(),
  detail: createApiCallState<StudentDetail | null>(),
  update: createApiCallState<Student>(),
  delete: createApiCallState<Student>(),
};

function mockStudentDetail(studentId: string, students?: Student[]): StudentDetail | null {
  const list = students ?? seedStudents;
  const student = list.find((s) => s.id === studentId);
  if (!student) return null;
  return {
    ...student,
    advisor: studentDetailDefaults.advisor,
    consumedCredits: studentDetailDefaults.consumedCredits,
    lastLesson: studentDetailDefaults.lastLesson,
    aiLearningSummary: studentDetailDefaults.aiLearningSummary,
    homeworkOverdueWarning: studentDetailDefaults.homeworkOverdueWarning,
  };
}

function isMockStudentId(studentId: string) {
  return /^S\d+$/i.test(studentId);
}

export const studentService = {
  async list(): Promise<Student[]> {
    return apiClient.requestWithFallback<Student[]>(
      "/students",
      { method: "GET" },
      () => [...seedStudents],
      studentApiState.list
    );
  },

  /** 新增学员 */
  async createStudent(data: CreateStudentInput): Promise<Student> {
    return apiClient.requestWithFallback<Student>(
      "/students",
      { method: "POST", body: JSON.stringify(data) },
      () => ({ ...data, id: generateId("S") }),
      studentApiState.create
    );
  },

  /** 查看学员详情（含档案扩展字段） */
  async getStudentDetail(studentId: string, students?: Student[]): Promise<StudentDetail | null> {
    if (isMockStudentId(studentId)) {
      return mockStudentDetail(studentId, students);
    }

    return apiClient.requestWithFallback<StudentDetail | null>(
      `/students/${studentId}`,
      { method: "GET" },
      () => mockStudentDetail(studentId, students),
      studentApiState.detail
    );
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    return apiClient.requestWithFallback<Student>(
      `/students/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      () => ({ ...seedStudents.find((s) => s.id === id)!, ...data }),
      studentApiState.update
    );
  },

  async deleteStudent(id: string): Promise<Student> {
    return apiClient.requestWithFallback<Student>(
      `/students/${id}`,
      { method: "DELETE" },
      () => ({ ...seedStudents.find((s) => s.id === id)!, status: "archived" }),
      studentApiState.delete
    );
  },

  async getFormOptions() {
    return { tags: [...availableStudentTags], grades: [...gradeOptions] };
  },

  getFormOptionsSync() {
    return { tags: [...availableStudentTags], grades: [...gradeOptions] };
  },
};
