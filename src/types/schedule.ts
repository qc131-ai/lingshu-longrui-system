export type ScheduleStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "student_leave"
  | "teacher_leave"
  | "makeup_pending";

export type Schedule = {
  id: string;
  lessonRecordId?: string;
  courseId?: string;
  teacherId?: string;
  studentId?: string;
  classId?: string;
  roomId?: string;
  colIndex: number;
  topIndex: number;
  durationSlots: number;
  title: string;
  courseName?: string;
  studentName?: string;
  className?: string;
  teacher: string;
  room: string;
  classroom?: string;
  timeString: string;
  startTime?: string;
  endTime?: string;
  type: string;
  status?: ScheduleStatus;
  date?: string;
  hasConflict?: boolean;
  notes?: string;
  cancelReason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** @deprecated 使用 Schedule */
export type ScheduleEvent = Schedule;
