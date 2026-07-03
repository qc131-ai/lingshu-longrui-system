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

const nonEmptyStringSchema = z.string().trim().min(1, "不能为空");
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式必须为 YYYY-MM-DD");
const timeStringSchema = z.string().regex(/^\d{1,2}:\d{2}$/, "格式必须为 HH:mm");
const optionalQueryStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
  return trimmed;
}, z.string().optional());
const optionalQueryDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
  return trimmed;
}, dateStringSchema.optional());
const scheduleStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "student_leave",
  "teacher_leave",
  "makeup_pending",
]);
const lessonRecordStatusSchema = z.enum(["draft", "pending_feedback", "submitted", "completed", "cancelled"]);

export const createScheduleSchema = z.object({
  studentId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  courseName: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  teacher: z.string().optional(),
  classId: z.string().min(1).optional(),
  roomId: z.string().optional(),
  classroom: z.string().optional(),
  date: dateStringSchema,
  startTime: timeStringSchema,
  endTime: timeStringSchema.optional(),
  duration: z.coerce.number().positive().optional(),
  consumedHours: z.coerce.number().positive().optional(),
  lessonType: z.enum(["class", "exam", "meeting"]).optional(),
  status: scheduleStatusSchema.optional(),
  notes: z.string().optional(),
}).refine((input) => input.duration !== undefined || input.consumedHours !== undefined || input.endTime !== undefined, {
  message: "duration, consumedHours, or endTime is required",
});

export const scheduleQuerySchema = z.object({
  startDate: optionalQueryDateSchema,
  endDate: optionalQueryDateSchema,
  weekStart: optionalQueryDateSchema,
  weekEnd: optionalQueryDateSchema,
  dateFrom: optionalQueryDateSchema,
  dateTo: optionalQueryDateSchema,
  teacherId: optionalQueryStringSchema,
  studentId: optionalQueryStringSchema,
  classId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  status: z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
    return trimmed;
  }, scheduleStatusSchema.optional()),
});

export const updateScheduleSchema = z.object({
  courseId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  studentId: z.string().min(1).nullable().optional(),
  classId: z.string().min(1).nullable().optional(),
  roomId: z.string().min(1).optional(),
  classroom: z.string().optional(),
  date: dateStringSchema.optional(),
  startTime: timeStringSchema.optional(),
  endTime: timeStringSchema.optional(),
  duration: z.coerce.number().positive().optional(),
  status: scheduleStatusSchema.optional(),
  cancelReason: z.string().optional(),
  notes: z.string().optional(),
});

export const updateScheduleStatusSchema = z.object({
  status: scheduleStatusSchema,
  cancelReason: z.string().optional(),
  notes: z.string().optional(),
});

const lessonRecordBaseSchema = z.object({
  scheduleId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  teacherId: z.string().min(1),
  date: dateStringSchema,
  startTime: timeStringSchema.optional(),
  endTime: timeStringSchema.optional(),
  classroom: z.string().optional(),
  duration: z.coerce.number().nonnegative().optional(),
  topic: z.string().optional(),
  attendance: z.enum(["present", "absent", "student_leave", "teacher_leave"]).optional(),
  status: lessonRecordStatusSchema.optional(),
  feedbackStatus: z.enum(["submitted", "pending"]).optional(),
  creditsConsumed: z.coerce.number().nonnegative().optional(),
  performance: z.string().optional(),
  knowledgeMastery: z.string().optional(),
  homework: z.string().optional(),
  nextPlan: z.string().optional(),
  internalNotes: z.string().optional(),
  aiSummary: z.string().optional(),
  needAdvisorFollowUp: z.boolean().optional(),
  syncToParent: z.boolean().optional(),
});

export const createLessonRecordSchema = lessonRecordBaseSchema.refine((input) => input.studentId || input.classId, {
  message: "studentId or classId is required",
});

export const updateLessonRecordSchema = lessonRecordBaseSchema.partial();

export const lessonRecordQuerySchema = z.object({
  startDate: optionalQueryDateSchema,
  endDate: optionalQueryDateSchema,
  teacherId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  status: z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "Invalid Date") return undefined;
    return trimmed;
  }, lessonRecordStatusSchema.optional()),
  search: optionalQueryStringSchema,
});

export const updateLessonRecordStatusSchema = z.object({
  status: lessonRecordStatusSchema,
  aiSummary: z.string().optional(),
});

export const deductCreditSchema = z.object({
  aiSummary: z.string().optional(),
});

export const confirmDeductionSchema = z.object({
  consumedHours: z.coerce.number().positive(),
  deductionNote: z.string().optional(),
  syncToParent: z.boolean().optional(),
});

export const creditAccountsQuerySchema = z.object({
  studentId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  lowBalance: optionalQueryStringSchema,
  status: optionalQueryStringSchema,
});

export const creditTransactionsQuerySchema = z.object({
  studentId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  transactionType: optionalQueryStringSchema,
  status: optionalQueryStringSchema,
  startDate: optionalQueryDateSchema,
  endDate: optionalQueryDateSchema,
  dateFrom: optionalQueryDateSchema,
  dateTo: optionalQueryDateSchema,
});

export const adjustCreditsSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  transactionType: z.string().min(1).optional(),
  adjustType: z.string().min(1).optional(),
  hoursChange: z.coerce.number().optional(),
  creditsAmount: z.coerce.number().optional(),
  courseName: z.string().optional(),
  amount: z.coerce.number().optional(),
  note: z.string().optional(),
  notes: z.string().optional(),
}).refine((input) => input.hoursChange !== undefined || input.creditsAmount !== undefined, {
  message: "hoursChange or creditsAmount is required",
}).refine((input) => input.transactionType || input.adjustType, {
  message: "transactionType or adjustType is required",
});

export const createLeaveRecordSchema = z.object({
  type: z.enum(["student_leave", "teacher_leave", "reschedule", "cancel", "makeup"]),
  studentId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1),
  originalDate: dateStringSchema,
  makeupDate: dateStringSchema.optional(),
  reason: z.string().min(1),
  deductCredit: z.boolean().optional(),
  status: z.enum(["pending", "approved", "rejected", "makeup_scheduled", "makeup_completed"]).optional(),
  notifyStatus: z.string().optional(),
});

export const updateLeaveRecordSchema = createLeaveRecordSchema.partial();

export const leaveMakeupRequestTypeSchema = z.enum([
  "student_leave",
  "teacher_leave",
  "reschedule",
  "cancellation",
  "makeup",
]);

export const leaveMakeupStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "makeup_pending",
  "makeup_scheduled",
  "completed",
  "parent_notified",
  "cancelled",
]);

export const leaveMakeupQuerySchema = z.object({
  studentId: optionalQueryStringSchema,
  teacherId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  classId: optionalQueryStringSchema,
  requestType: optionalQueryStringSchema,
  status: optionalQueryStringSchema,
  startDate: optionalQueryDateSchema,
  endDate: optionalQueryDateSchema,
});

export const createLeaveMakeupSchema = z.object({
  scheduleId: z.string().min(1),
  lessonRecordId: z.string().min(1).optional(),
  requestType: leaveMakeupRequestTypeSchema,
  reason: z.string().min(1),
  deductCredit: z.boolean().optional(),
  needMakeup: z.boolean().optional(),
  newDate: dateStringSchema.optional(),
  newStartTime: timeStringSchema.optional(),
  newEndTime: timeStringSchema.optional(),
}).refine((input) => input.requestType !== "reschedule" || Boolean(input.newDate && input.newStartTime && input.newEndTime), {
  message: "调课申请需要填写新上课日期和时间",
  path: ["newDate"],
});

export const updateLeaveMakeupSchema = z.object({
  requestType: leaveMakeupRequestTypeSchema.optional(),
  lessonRecordId: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).optional(),
  deductCredit: z.boolean().optional(),
  needMakeup: z.boolean().optional(),
  newDate: dateStringSchema.nullable().optional(),
  newStartTime: timeStringSchema.nullable().optional(),
  newEndTime: timeStringSchema.nullable().optional(),
  status: leaveMakeupStatusSchema.optional(),
});

export const updateLeaveMakeupStatusSchema = z.object({
  status: leaveMakeupStatusSchema,
  approvalNote: z.string().optional(),
  rejectReason: z.string().optional(),
});

export const approveLeaveMakeupSchema = z.object({
  approvalNote: z.string().optional(),
});

export const rejectLeaveMakeupSchema = z.object({
  rejectReason: z.string().min(1),
});

export const scheduleMakeupSchema = z.object({
  date: dateStringSchema,
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  teacherId: z.string().min(1).optional(),
  classroom: z.string().optional(),
  lessonType: z.enum(["class", "exam", "meeting"]).optional(),
  notes: z.string().optional(),
});

export const notifyParentSchema = z.object({
  message: z.string().optional(),
});

export const generateReportSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  reportType: z.enum(["weekly", "monthly", "stage", "custom"]).optional(),
  reportPeriodStart: dateStringSchema.optional(),
  reportPeriodEnd: dateStringSchema.optional(),
  periodStart: dateStringSchema.optional(),
  periodEnd: dateStringSchema.optional(),
  includeLessons: z.boolean().optional(),
  includeCredits: z.boolean().optional(),
  includeLeaveMakeup: z.boolean().optional(),
  includeHomework: z.boolean().optional(),
  includeAiSummary: z.boolean().optional(),
});

export const reportQuerySchema = z.object({
  studentId: optionalQueryStringSchema,
  courseId: optionalQueryStringSchema,
  advisorId: optionalQueryStringSchema,
  reportType: optionalQueryStringSchema,
  status: optionalQueryStringSchema,
  startDate: optionalQueryDateSchema,
  endDate: optionalQueryDateSchema,
});

export const updateReportSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  teacherFeedbackSummary: z.string().optional(),
  weaknessAnalysis: z.string().optional(),
  nextStepPlan: z.string().optional(),
  aiSummary: z.string().optional(),
  parentVisibleContent: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(["draft", "generated", "reviewed", "sent", "archived"]),
});

export const sendReportSchema = z.object({
  channel: z.enum(["wecom", "sms", "email"]).optional(),
});

export const aiAssistantSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const aiToneSchema = z.enum(["professional", "friendly", "urgent", "warm", "concise"]).optional();

export const generateRenewalSuggestionSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  tone: z.enum(["professional", "friendly", "urgent"]).optional(),
  includeParentMessage: z.boolean().optional(),
});

export const generateParentMessageSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  scenario: z.enum([
    "low_credit_reminder",
    "progress_update",
    "makeup_notice",
    "renewal_followup",
    "report_delivery",
    "risk_followup",
  ]),
  tone: z.enum(["professional", "friendly", "urgent", "warm", "concise"]).optional(),
});

export const polishReportSchema = z.object({
  reportId: z.string().min(1),
  tone: z.enum(["professional", "warm", "concise"]).optional(),
});

export const studentRiskSummarySchema = z.object({
  studentId: z.string().min(1),
  periodStart: dateStringSchema.optional(),
  periodEnd: dateStringSchema.optional(),
});

export const uploadFileSchema = z.object({
  category: z.enum(["student_material", "homework_attachment", "competition_certificate", "contract", "report_file"]),
  studentId: z.string().min(1).optional(),
  lessonRecordId: z.string().min(1).optional(),
  parentReportId: z.string().min(1).optional(),
});

export const importTypeParamSchema = z.object({
  type: z.enum([
    "students",
    "courses",
    "teachers",
    "classes",
    "credits",
    "credit-balances",
    "credit-accounts",
    "credit-transactions",
    "schedules",
    "lesson-records",
    "leave-makeup",
    "parent-reports",
    "orders",
  ]),
});

export const importPreviewSchema = z.object({
  type: z
    .enum(["students", "courses", "teachers", "classes", "credits", "credit-balances", "schedules", "lesson-records"])
    .optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});
