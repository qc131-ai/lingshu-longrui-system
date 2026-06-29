export type Student = {
  id: string;
  name: string;
  avatar?: string;
  grade: string;
  school: string;
  phone: string;
  remainingCredits: number;
  riskStatus: "high" | "medium" | "low" | "normal";
  tags: string[];
  enrollmentDate: string;
  recentTestScore?: number;
  status?: "active" | "graduated" | "archived";
};

export type StudentDetail = Student & {
  advisor: string;
  consumedCredits: number;
  lastLesson: string;
  aiLearningSummary: string;
  homeworkOverdueWarning?: string;
};
