import type { LessonRecord } from "../types";

export const lessonRecords: LessonRecord[] = [
  { id: "LR001", classId: "CL001", className: "春季AP微积分周末班", studentId: "S001", studentName: "张子涵", teacherId: "T001", teacherName: "王建国", date: "2024-03-25", topic: "导数应用", attendance: "present", status: "completed", feedbackStatus: "pending", creditsConsumed: 2 },
  { id: "LR002", classId: "CL002", className: "春季AMC10集训A班", studentId: "S002", studentName: "李佳怡", teacherId: "T002", teacherName: "李明", date: "2024-03-25", topic: "数论基础", attendance: "student_leave", status: "pending_feedback", feedbackStatus: "pending", creditsConsumed: 0 },
  { id: "LR003", classId: "CL003", className: "托福冲刺晚班", studentId: "S003", studentName: "王宇航", teacherId: "T003", teacherName: "Sarah", date: "2024-03-26", topic: "听力讲座精听", attendance: "present", status: "draft", feedbackStatus: "pending", creditsConsumed: 2 },
];
