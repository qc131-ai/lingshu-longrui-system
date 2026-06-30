import type { UserRole } from "../services/authService";

export const roleLabels: Record<UserRole, string> = {
  admin: "管理员",
  academic_manager: "教务主管",
  advisor: "顾问",
  teacher: "老师",
  finance: "财务",
};

export const permissions: Record<string, UserRole[]> = {
  createStudent: ["admin", "academic_manager", "advisor"],
  createCourse: ["admin", "academic_manager"],
  createSchedule: ["admin", "academic_manager", "advisor"],
  submitLessonRecord: ["admin", "academic_manager", "teacher"],
  deductCredit: ["admin", "academic_manager", "advisor", "teacher"],
  adjustCredit: ["admin", "academic_manager", "finance"],
  generateReport: ["admin", "academic_manager", "advisor"],
  editReport: ["admin", "academic_manager", "advisor"],
  sendReport: ["admin", "academic_manager"],
};

export function can(role: UserRole | undefined, permission: keyof typeof permissions) {
  return Boolean(role && permissions[permission].includes(role));
}
