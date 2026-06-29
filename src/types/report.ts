export type ReportTrendPoint = {
  name: string;
  score: number;
};

export type ReportRadarPoint = {
  subject: string;
  A: number;
  fullMark: number;
};

export type DashboardChartPoint = {
  name: string;
  revenue: number;
  students: number;
};

export type DashboardTask = {
  title: string;
  time: string;
  type: "urgent" | "normal" | "warning";
};

export type ParentReportCourseRecord = {
  date: string;
  course: string;
  topic: string;
  teacher: string;
  feedback: string;
};

export type ParentReport = {
  studentName: string;
  grade: string;
  courses: string;
  advisor: string;
  period: string;
  monthlyHours: number;
  attendanceRate: number;
  homeworkRate: number;
  scoreImprovement: number;
  courseRecords: ParentReportCourseRecord[];
};
