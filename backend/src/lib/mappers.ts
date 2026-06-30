import type {
  Class,
  Course,
  CreditAccount,
  CreditTransaction,
  LeaveRecord,
  LessonRecord,
  ParentReport,
  Room,
  Schedule,
  Student,
  Teacher,
  User,
} from "@prisma/client";

type StudentWithAccount = Student & {
  creditAccount?: CreditAccount | null;
  creditAccounts?: CreditAccount[];
  advisor?: Pick<User, "displayName"> | null;
};

type CourseLike = Course;

type ScheduleWithRelations = Schedule & {
  course?: Pick<Course, "id" | "name"> | null;
  teacher?: Pick<Teacher, "name"> | null;
  class?: Pick<Class, "id" | "name"> | null;
  student?: Pick<Student, "id" | "name"> | null;
  room?: Pick<Room, "label" | "code"> | null;
  creator?: Pick<User, "displayName"> | null;
  lessonRecords?: Array<Pick<LessonRecord, "id">>;
};

type LessonWithRelations = LessonRecord & {
  student?: Pick<Student, "name"> | null;
  class?: Pick<Class, "name"> | null;
  course?: Pick<Course, "name"> | null;
  teacher?: Pick<Teacher, "name"> | null;
};

type TransactionWithRelations = CreditTransaction & {
  student?: Pick<Student, "name"> | null;
  course?: Pick<Course, "name"> | null;
  account?: Pick<CreditAccount, "id" | "balance" | "totalPurchased" | "totalConsumed" | "totalGifted" | "frozenHours" | "lowBalance" | "status"> | null;
};

type ClassWithRelations = Class & {
  course?: Pick<Course, "name"> | null;
  teacher?: Pick<Teacher, "name"> | null;
  enrollments?: Array<{ studentId: string; student?: Pick<Student, "name"> | null }>;
};

type TeacherWithRelations = Teacher & {
  classes?: Array<Pick<Class, "id" | "name">>;
};

type LeaveWithRelations = LeaveRecord & {
  student?: Pick<Student, "name"> | null;
  teacher?: Pick<Teacher, "name"> | null;
  class?: Pick<Class, "name"> | null;
};

export function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function toStudent(student: StudentWithAccount) {
  const accounts = student.creditAccounts ?? (student.creditAccount ? [student.creditAccount] : []);
  const remainingCredits = accounts.reduce((sum, account) => sum + toNumber(account.balance), 0);
  return {
    id: student.id,
    name: student.name,
    avatar: student.avatarUrl ?? undefined,
    grade: student.grade,
    school: student.school ?? "",
    phone: student.phone,
    remainingCredits,
    riskStatus: student.riskStatus.toLowerCase(),
    tags: Array.isArray(student.tags) ? student.tags : [],
    enrollmentDate: student.enrollmentDate.toISOString().slice(0, 10),
    recentTestScore: student.recentTestScore ? toNumber(student.recentTestScore) : undefined,
  };
}

export function toStudentDetail(student: StudentWithAccount & { lessonRecords?: LessonWithRelations[] }) {
  const lastLesson = student.lessonRecords?.[0];
  const accounts = student.creditAccounts ?? (student.creditAccount ? [student.creditAccount] : []);
  const consumedCredits = accounts.reduce((sum, account) => sum + toNumber(account.totalConsumed), 0);
  return {
    ...toStudent(student),
    advisor: student.advisor?.displayName ?? "未分配",
    consumedCredits,
    lastLesson: lastLesson
      ? `${lastLesson.lessonDate.toISOString().slice(0, 10)} · ${lastLesson.class?.name ?? "课程"}`
      : "暂无上课记录",
    aiLearningSummary: student.aiLearningSummary ?? "暂无 AI 学习总结",
    homeworkOverdueWarning: student.homeworkOverdueWarning ?? undefined,
  };
}

export function toCourse(course: CourseLike) {
  return {
    id: course.id,
    name: course.name,
    courseName: course.name,
    category: course.category.toLowerCase(),
    level: course.level,
    totalLessons: course.totalLessons,
    totalHours: course.totalLessons,
    price: toNumber(course.price),
    description: course.description ?? undefined,
    teachingMethod: course.teachingMethod ?? undefined,
    teachingMode: course.teachingMethod ?? undefined,
    targetGrades: Array.isArray(course.targetGrades) ? course.targetGrades : undefined,
    suitableGrades: Array.isArray(course.targetGrades) ? course.targetGrades : undefined,
    responsibleTeacherId: course.responsibleTeacherId ?? undefined,
    syllabus: course.syllabus ?? undefined,
    status: course.status.toLowerCase(),
  };
}

export function toClass(item: ClassWithRelations) {
  return {
    id: item.id,
    name: item.name,
    courseId: item.courseId,
    courseName: item.course?.name ?? "",
    teacherId: item.teacherId,
    teacherName: item.teacher?.name ?? "",
    schedule: item.scheduleDesc ?? "",
    scheduleDesc: item.scheduleDesc ?? "",
    capacity: item.capacity,
    enrolled: item.enrolledCount,
    enrolledCount: item.enrolledCount,
    classroom: item.classroom ?? "",
    status: item.status,
    studentIds: item.enrollments?.map((enrollment) => enrollment.studentId) ?? [],
    studentNames: item.enrollments?.map((enrollment) => enrollment.student?.name).filter(Boolean) ?? [],
  };
}

export function toTeacher(teacher: TeacherWithRelations) {
  return {
    id: teacher.id,
    userId: teacher.userId ?? undefined,
    name: teacher.name,
    subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
    type: teacher.type.toLowerCase(),
    rating: teacher.rating ? toNumber(teacher.rating) : undefined,
    classesCount: teacher.classesCount,
    availableTime: Array.isArray(teacher.availableTime) ? teacher.availableTime : [],
    feedbackRate: teacher.feedbackRate ? toNumber(teacher.feedbackRate) : undefined,
    status: teacher.status,
    classes: teacher.classes?.map((item) => ({ id: item.id, name: item.name })) ?? [],
  };
}

export function toSchedule(schedule: ScheduleWithRelations) {
  const startHour = schedule.startTime.getUTCHours();
  const startMinute = schedule.startTime.getUTCMinutes();
  const duration = toNumber(schedule.durationHours);
  const day = schedule.lessonDate.getUTCDay();
  const colIndex = day === 0 ? 6 : day - 1;
  const topIndex = startHour - 8;
  const startText = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
  const endText = `${String(schedule.endTime.getUTCHours()).padStart(2, "0")}:${String(schedule.endTime.getUTCMinutes()).padStart(2, "0")}`;

  return {
    id: schedule.id,
    lessonRecordId: schedule.lessonRecords?.[0]?.id,
    courseId: schedule.courseId,
    teacherId: schedule.teacherId,
    studentId: schedule.studentId ?? undefined,
    classId: schedule.classId ?? undefined,
    roomId: schedule.roomId ?? undefined,
    colIndex,
    topIndex,
    durationSlots: duration,
    title: schedule.title || schedule.course?.name || "课程",
    courseName: schedule.course?.name ?? schedule.title,
    studentName: schedule.student?.name ?? "",
    className: schedule.class?.name ?? "",
    teacher: schedule.teacher?.name ?? "",
    room: schedule.room?.label ?? schedule.room?.code ?? schedule.classroom ?? "",
    classroom: schedule.classroom ?? schedule.room?.label ?? schedule.room?.code ?? "",
    timeString: `${startText} - ${endText}`,
    startTime: startText,
    endTime: endText,
    type: schedule.eventType.toLowerCase(),
    status: schedule.status.toLowerCase(),
    date: schedule.lessonDate.toISOString().slice(0, 10),
    hasConflict: schedule.hasConflict ?? false,
    notes: schedule.notes ?? "",
    cancelReason: schedule.cancelReason ?? "",
    createdBy: schedule.creator?.displayName ?? "",
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export function toLessonRecord(record: LessonWithRelations) {
  const startText = record.startTime
    ? `${String(record.startTime.getUTCHours()).padStart(2, "0")}:${String(record.startTime.getUTCMinutes()).padStart(2, "0")}`
    : "";
  const endText = record.endTime
    ? `${String(record.endTime.getUTCHours()).padStart(2, "0")}:${String(record.endTime.getUTCMinutes()).padStart(2, "0")}`
    : "";
  return {
    id: record.id,
    scheduleId: record.scheduleId ?? undefined,
    courseId: record.courseId ?? undefined,
    courseName: record.course?.name ?? "",
    classId: record.classId ?? "",
    className: record.class?.name ?? "",
    studentId: record.studentId ?? "",
    studentName: record.student?.name ?? "",
    teacherId: record.teacherId,
    teacherName: record.teacher?.name ?? "",
    date: record.lessonDate.toISOString().slice(0, 10),
    startTime: startText,
    endTime: endText,
    timeString: startText && endText ? `${startText} - ${endText}` : "",
    classroom: record.classroom ?? "",
    duration: toNumber(record.durationHours),
    topic: record.topic ?? "",
    attendance: record.attendance.toLowerCase(),
    status: record.status.toLowerCase(),
    feedbackStatus: record.feedbackStatus.toLowerCase(),
    deductionStatus: record.deductionStatus.toLowerCase(),
    creditsConsumed: toNumber(record.creditsConsumed),
    performance: record.performance ?? undefined,
    knowledgeMastery: record.knowledgeMastery ?? undefined,
    homework: record.homework ?? undefined,
    nextPlan: record.nextPlan ?? undefined,
    internalNotes: record.internalNotes ?? undefined,
    aiSummary: record.aiSummary ?? undefined,
    needAdvisorFollowUp: record.needAdvisorFollowUp ?? false,
    syncToParent: record.syncToParent ?? false,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toCreditTransaction(transaction: TransactionWithRelations) {
  const delta = toNumber(transaction.creditsDelta);
  const balanceBefore = toNumber(transaction.balanceBefore);
  const balanceAfter = toNumber(transaction.balanceAfter);
  const adjustType = transaction.adjustType.toLowerCase();
  const transactionType = adjustType === "lesson_deduct" ? "lesson_deduction" : adjustType;
  return {
    id: transaction.id,
    studentId: transaction.studentId,
    studentName: transaction.student?.name ?? "",
    courseId: transaction.courseId ?? undefined,
    courseName: transaction.courseName ?? transaction.course?.name ?? "课时调整",
    lessonRecordId: transaction.lessonRecordId ?? undefined,
    creditAccountId: transaction.accountId,
    transactionType,
    hoursChange: delta,
    balanceBefore,
    balanceAfter,
    operatorId: transaction.createdBy ?? undefined,
    note: transaction.notes ?? undefined,
    amount: toNumber(transaction.amount),
    creditsAdded: delta,
    creditsConsumed: transaction.adjustType === "LESSON_DEDUCT" ? Math.abs(delta) : 0,
    date: transaction.transactionDate.toISOString().slice(0, 10),
    status: transaction.status.toLowerCase(),
    expireDate: transaction.expireDate?.toISOString().slice(0, 10),
    adjustType,
    notes: transaction.notes ?? undefined,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function toCreditAccount(account: CreditAccount & {
  student?: Pick<Student, "id" | "name" | "grade" | "phone"> | null;
  course?: Pick<Course, "id" | "name"> | null;
}) {
  const remainingHours = toNumber(account.balance);
  return {
    id: account.id,
    organizationId: account.organizationId ?? undefined,
    studentId: account.studentId,
    student: account.student ?? undefined,
    studentName: account.student?.name ?? "",
    courseId: account.courseId ?? undefined,
    courseName: account.course?.name ?? "",
    totalPurchasedHours: toNumber(account.totalPurchased),
    totalConsumedHours: toNumber(account.totalConsumed),
    remainingHours,
    giftedHours: toNumber(account.totalGifted),
    frozenHours: toNumber(account.frozenHours),
    lowBalance: account.lowBalance || remainingHours <= 5,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    balance: remainingHours,
    totalPurchased: toNumber(account.totalPurchased),
    totalConsumed: toNumber(account.totalConsumed),
    totalGifted: toNumber(account.totalGifted),
  };
}

export function toParentReport(report: ParentReport) {
  const extended = report as ParentReport & {
    course?: { name: string } | null;
    advisor?: { displayName: string } | null;
    sender?: { displayName: string } | null;
  };
  return {
    id: report.id,
    studentId: report.studentId,
    courseId: report.courseId ?? undefined,
    courseName: extended.course?.name ?? undefined,
    advisorId: report.advisorId ?? undefined,
    studentName: report.studentName,
    grade: report.grade,
    reportType: report.reportType.toLowerCase(),
    title: report.title,
    summary: report.summary ?? "",
    courseProgress: report.courseProgress ?? "",
    lessonSummary: report.lessonSummary ?? "",
    teacherFeedbackSummary: report.teacherFeedbackSummary ?? "",
    homeworkSummary: report.homeworkSummary ?? "",
    attendanceSummary: report.attendanceSummary ?? "",
    creditSummary: report.creditSummary ?? "",
    leaveMakeupSummary: report.leaveMakeupSummary ?? "",
    weaknessAnalysis: report.weaknessAnalysis ?? "",
    nextStepPlan: report.nextStepPlan ?? "",
    parentVisibleContent: report.parentVisibleContent ?? "",
    courses: report.coursesSummary,
    advisor: extended.advisor?.displayName ?? "",
    period: report.periodLabel,
    reportPeriodStart: report.periodStart.toISOString().slice(0, 10),
    reportPeriodEnd: report.periodEnd.toISOString().slice(0, 10),
    monthlyHours: toNumber(report.monthlyHours),
    attendanceRate: toNumber(report.attendanceRate),
    homeworkRate: toNumber(report.homeworkRate),
    scoreImprovement: toNumber(report.scoreImprovement),
    courseRecords: report.courseRecords,
    aiSummary: report.aiSummary ?? undefined,
    trendData: report.trendData ?? undefined,
    radarData: report.radarData ?? undefined,
    status: report.status.toLowerCase(),
    sentAt: report.sentAt?.toISOString(),
    sentBy: extended.sender?.displayName ?? undefined,
    sentChannel: report.sentChannel ?? undefined,
    generatedAt: report.generatedAt?.toISOString(),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function toLeaveRecord(record: LeaveWithRelations) {
  return {
    id: record.id,
    type: record.type.toLowerCase(),
    studentId: record.studentId ?? undefined,
    studentName: record.student?.name ?? "",
    teacherId: record.teacherId ?? undefined,
    teacherName: record.teacher?.name ?? "",
    classId: record.classId,
    className: record.class?.name ?? "",
    originalDate: record.originalDate.toISOString().slice(0, 10),
    makeupDate: record.makeupDate?.toISOString().slice(0, 10),
    reason: record.reason,
    deductCredit: record.deductCredit,
    status: record.status.toLowerCase(),
    notifyStatus: record.notifyStatus,
  };
}
