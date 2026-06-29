export type Course = {
  id: string;
  name: string;
  courseName?: string;
  category: "math" | "physics" | "chemistry" | "english" | "competition" | "research";
  level: string;
  totalLessons: number;
  totalHours?: number;
  price: number;
  description?: string;
  teachingMethod?: string;
  teachingMode?: string;
  targetGrades?: string[];
  suitableGrades?: string[];
  responsibleTeacherId?: string;
  syllabus?: string;
  status?: "active" | "draft" | "archived";
};

export type Class = {
  id: string;
  name: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  schedule: string;
  capacity: number;
  enrolled: number;
  classroom: string;
  courseName?: string;
  status?: string;
  studentIds?: string[];
  studentNames?: string[];
};

/** @deprecated 使用 Class */
export type ClassModel = Class;
