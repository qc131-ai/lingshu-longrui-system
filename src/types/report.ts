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
  id?: string;
  studentId?: string;
  courseId?: string;
  courseName?: string;
  advisorId?: string;
  studentName: string;
  grade: string;
  reportType?: "weekly" | "monthly" | "stage" | "custom";
  title?: string;
  summary?: string;
  courseProgress?: string;
  lessonSummary?: string;
  teacherFeedbackSummary?: string;
  homeworkSummary?: string;
  attendanceSummary?: string;
  creditSummary?: string;
  leaveMakeupSummary?: string;
  weaknessAnalysis?: string;
  nextStepPlan?: string;
  aiSummary?: string;
  parentVisibleContent?: string;
  courses: string;
  advisor: string;
  period: string;
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  monthlyHours: number;
  attendanceRate: number;
  homeworkRate: number;
  scoreImprovement: number;
  courseRecords: ParentReportCourseRecord[];
  trendData?: ReportTrendPoint[];
  radarData?: ReportRadarPoint[];
  status?: "draft" | "generated" | "reviewed" | "sent" | "archived";
  sentAt?: string;
  sentBy?: string;
  sentChannel?: string;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
