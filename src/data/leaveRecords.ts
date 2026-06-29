import type { LeaveRecord } from "../types";

export const leaveRecords: LeaveRecord[] = [
  { id: "L001", type: "student_leave", studentId: "S002", studentName: "李佳怡", classId: "CL002", className: "春季AMC10集训A班", originalDate: "2024-03-25", reason: "生病发烧", deductCredit: false, status: "pending", notifyStatus: "pending" },
  { id: "L002", type: "teacher_leave", teacherName: "王建国", classId: "CL001", className: "春季AP微积分周末班", originalDate: "2024-03-30", reason: "参加学术会议", deductCredit: false, status: "approved", notifyStatus: "notified" },
];
