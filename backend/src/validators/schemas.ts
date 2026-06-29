import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().min(1) });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createStudentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  grade: z.string().optional(),
  school: z.string().optional(),
  remainingCredits: z.coerce.number().nonnegative().optional(),
  riskStatus: z.enum(["high", "medium", "low", "normal"]).optional(),
  tags: z.array(z.string()).optional(),
  enrollmentDate: z.coerce.date().optional(),
  targetCountry: z.string().optional(),
  targetDirection: z.string().optional(),
  parentPhone: z.string().optional(),
  advisorId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

const courseBaseSchema = z.object({
  name: z.string().min(1).optional(),
  courseName: z.string().min(1).optional(),
  category: z.enum(["math", "physics", "chemistry", "english", "competition", "research"]).optional(),
  level: z.string().min(1).optional(),
  totalLessons: z.coerce.number().int().positive().optional(),
  totalHours: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
  teachingMethod: z.string().optional(),
  teachingMode: z.string().optional(),
  targetGrades: z.array(z.string()).optional(),
  suitableGrades: z.array(z.string()).optional(),
  responsibleTeacherId: z.string().min(1).optional(),
  syllabus: z.string().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
});

export const createCourseSchema = courseBaseSchema
  .refine((data) => Boolean(data.name || data.courseName), { message: "课程名称不能为空", path: ["name"] })
  .refine((data) => Boolean(data.category), { message: "课程分类不能为空", path: ["category"] })
  .refine((data) => Boolean(data.level), { message: "课程层级不能为空", path: ["level"] })
  .refine((data) => data.price !== undefined, { message: "课程价格不能为空", path: ["price"] })
  .refine((data) => Boolean(data.totalLessons || data.totalHours), { message: "总课时不能为空", path: ["totalLessons"] });

export const updateCourseSchema = courseBaseSchema;

export const courseQuerySchema = z.object({
  category: z.enum(["math", "physics", "chemistry", "english", "competition", "research"]).optional(),
  teachingMode: z.string().optional(),
  teachingMethod: z.string().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1),
});

export const createClassSchema = z.object({
  name: z.string().min(1),
  courseId: z.string().min(1),
  teacherId: z.string().min(1),
  scheduleDesc: z.string().optional(),
  capacity: z.coerce.number().int().positive(),
  enrolledCount: z.coerce.number().int().nonnegative().optional(),
  classroom: z.string().optional(),
  status: z.string().optional(),
  studentIds: z.array(z.string().min(1)).optional(),
});

export const updateClassSchema = createClassSchema.partial();

export const addClassStudentSchema = z.object({
  studentId: z.string().min(1),
});

export const createTeacherSchema = z.object({
  userId: z.string().min(1).optional(),
  name: z.string().min(1),
  subjects: z.array(z.string()).min(1),
  type: z.enum(["full-time", "part-time"]),
  rating: z.coerce.number().min(0).max(5).optional(),
  availableTime: z.array(z.string()).optional(),
  feedbackRate: z.coerce.number().min(0).max(100).optional(),
  status: z.string().optional(),
});

export const updateTeacherSchema = createTeacherSchema.partial();

export const createScheduleSchema = z.object({
  courseId: z.string().min(1).optional(),
  courseName: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  teacher: z.string().optional(),
  classId: z.string().min(1).optional(),
  roomId: z.string().optional(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  startTime: z.string().regex(/^\\d{1,2}:\\d{2}$/),
  duration: z.coerce.number().positive(),
});

export const scheduleQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const updateScheduleSchema = z.object({
  courseId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1).nullable().optional(),
  roomId: z.string().min(1).optional(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  startTime: z.string().regex(/^\\d{1,2}:\\d{2}$/).optional(),
  duration: z.coerce.number().positive().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  cancelReason: z.string().optional(),
});

export const createLessonRecordSchema = z.object({
  scheduleId: z.string().min(1).optional(),
  classId: z.string().min(1),
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  topic: z.string().optional(),
  attendance: z.enum(["present", "absent", "student_leave", "teacher_leave"]).optional(),
  status: z.enum(["completed", "scheduled", "cancelled", "need_makeup"]).optional(),
  feedbackStatus: z.enum(["submitted", "pending"]).optional(),
  creditsConsumed: z.coerce.number().nonnegative().optional(),
  performance: z.string().optional(),
  homework: z.string().optional(),
  aiSummary: z.string().optional(),
  needAdvisorFollowUp: z.boolean().optional(),
  syncToParent: z.boolean().optional(),
});

export const updateLessonRecordSchema = createLessonRecordSchema.partial();

export const deductCreditSchema = z.object({
  aiSummary: z.string().optional(),
});

export const createLeaveRecordSchema = z.object({
  type: z.enum(["student_leave", "teacher_leave", "reschedule", "cancel", "makeup"]),
  studentId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1),
  originalDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  makeupDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  reason: z.string().min(1),
  deductCredit: z.boolean().optional(),
  status: z.enum(["pending", "approved", "rejected", "makeup_scheduled", "makeup_completed"]).optional(),
  notifyStatus: z.string().optional(),
});

export const updateLeaveRecordSchema = createLeaveRecordSchema.partial();

export const creditAccountsQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
});

export const adjustCreditsSchema = z.object({
  studentId: z.string().min(1),
  adjustType: z.enum([
    "purchase",
    "gift",
    "transfer_in",
    "makeup_return",
    "deduct",
    "refund",
    "transfer_out",
    "manual",
  ]),
  creditsAmount: z.coerce.number().positive(),
  courseId: z.string().min(1).optional(),
  courseName: z.string().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const creditTransactionsQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  status: z.enum(["paid", "pending", "refunded"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const generateReportSchema = z.object({
  studentId: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(["draft", "generated", "sent"]),
});

export const sendReportSchema = z.object({
  channel: z.enum(["wecom", "sms", "email"]).optional(),
});

export const aiAssistantSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});

export const uploadFileSchema = z.object({
  category: z.enum(["student_material", "homework_attachment", "competition_certificate", "contract", "report_file"]),
  studentId: z.string().min(1).optional(),
  lessonRecordId: z.string().min(1).optional(),
  parentReportId: z.string().min(1).optional(),
});

export const importTypeParamSchema = z.object({
  type: z.enum(["students", "courses", "teachers", "credits", "schedules", "lesson-records", "orders"]),
});

export const importPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});
