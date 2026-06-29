export type LessonRecord = {
  id: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  date: string;
  topic: string;
  attendance: "present" | "absent" | "student_leave" | "teacher_leave";
  status: "completed" | "scheduled" | "cancelled" | "need_makeup";
  feedbackStatus: "submitted" | "pending";
  creditsConsumed: number;
  performance?: string;
  homework?: string;
  aiSummary?: string;
};

export type LeaveRecord = {
  id: string;
  type: "student_leave" | "teacher_leave" | "reschedule" | "cancel" | "makeup";
  studentId?: string;
  studentName?: string;
  teacherName?: string;
  classId: string;
  className: string;
  originalDate: string;
  makeupDate?: string;
  reason: string;
  deductCredit: boolean;
  status: "pending" | "approved" | "rejected" | "makeup_scheduled" | "makeup_completed";
  notifyStatus: "notified" | "pending";
};

export type Assessment = {
  id: string;
  studentName: string;
  courseName: string;
  title: string;
  teacherName: string;
  dueDate: string;
  submitStatus: "submitted" | "pending" | "late";
  gradeStatus: "graded" | "pending";
  score?: number;
};
