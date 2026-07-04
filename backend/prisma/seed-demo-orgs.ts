import "dotenv/config";
import { createHash } from "node:crypto";
import {
  CourseCategory,
  CourseStatus,
  CreditAdjustType,
  CreditTransactionStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  LessonAttendance,
  LessonDeductionStatus,
  LessonFeedbackStatus,
  LessonStatus,
  ParentReportStatus,
  ParentReportType,
  PrismaClient,
  ScheduleEventType,
  ScheduleStatus,
  StudentRiskStatus,
  TeacherType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type DemoOrg = {
  name: string;
  code: string;
  suffix: string;
  students: string[];
  courses: Array<{ name: string; category: CourseCategory; level: string }>;
  teachers: string[];
};

const demoOrgs: DemoOrg[] = [
  {
    name: "我来教育",
    code: "wolai",
    suffix: "wolai.com",
    students: ["陈一然", "林思远", "赵可欣"],
    courses: [
      { name: "AP 微积分强化", category: CourseCategory.MATH, level: "AP" },
      { name: "托福阅读提升", category: CourseCategory.ENGLISH, level: "托福" },
    ],
    teachers: ["吴老师", "周老师"],
  },
  {
    name: "广外留学",
    code: "guangwai",
    suffix: "guangwai.com",
    students: ["黄子墨", "梁雨桐", "何嘉宁"],
    courses: [
      { name: "雅思写作冲刺", category: CourseCategory.ENGLISH, level: "雅思" },
      { name: "英国本科申请规划", category: CourseCategory.RESEARCH, level: "申请规划" },
    ],
    teachers: ["陈老师", "李老师"],
  },
  {
    name: "AmazingX",
    code: "amazingx",
    suffix: "amazingx.com",
    students: ["Eric Chen", "Sophia Liu", "Kevin Zhang"],
    courses: [
      { name: "AMC 竞赛数学", category: CourseCategory.COMPETITION, level: "AMC" },
      { name: "AP Physics 1", category: CourseCategory.PHYSICS, level: "AP" },
    ],
    teachers: ["Liu Ye", "Anna Wang"],
  },
];

const roleConfigs = [
  { key: "admin", email: "admin", password: "admin123", role: UserRole.ADMIN, name: "管理员" },
  { key: "academic", email: "academic", password: "academic123", role: UserRole.ACADEMIC_MANAGER, name: "教务主管" },
  { key: "advisor", email: "advisor", password: "advisor123", role: UserRole.ADVISOR, name: "顾问" },
  { key: "teacher", email: "teacher", password: "teacher123", role: UserRole.TEACHER, name: "老师" },
  { key: "finance", email: "finance", password: "finance123", role: UserRole.FINANCE, name: "财务" },
] as const;

function roleCode(role: UserRole) {
  if (role === UserRole.ADMIN) return "admin";
  if (role === UserRole.ACADEMIC_MANAGER) return "academic_manager";
  if (role === UserRole.ADVISOR) return "advisor";
  if (role === UserRole.TEACHER) return "teacher";
  return "finance";
}

const permissionCodes = [
  ["dashboard.view", "查看首页", "dashboard"],
  ["students.manage", "管理学员", "students"],
  ["students.own.view", "查看负责学员", "students"],
  ["courses.manage", "管理课程", "courses"],
  ["classes.manage", "管理班级", "classes"],
  ["schedules.manage", "管理排课", "schedules"],
  ["schedules.own.view", "查看本人排课", "schedules"],
  ["lesson_records.manage", "管理上课记录", "lesson_records"],
  ["lesson_records.own.submit", "提交本人反馈", "lesson_records"],
  ["leaves.manage", "管理请假补课", "leaves"],
  ["teachers.manage", "管理老师中心", "teachers"],
  ["homework.own.manage", "管理本人作业测评", "homework"],
  ["reports.manage", "管理家长报告", "reports"],
  ["reports.own.manage", "管理负责学员报告", "reports"],
  ["credits.manage", "管理订单课时", "credits"],
  ["finance.manage", "管理财务数据", "finance"],
  ["ai.use", "使用 AI 教务助手", "ai"],
  ["operation_logs.view", "查看操作日志", "operation_logs"],
] as const;

const rolePermissions: Record<string, string[]> = {
  admin: permissionCodes.map(([code]) => code),
  academic: ["dashboard.view", "students.manage", "courses.manage", "classes.manage", "schedules.manage", "lesson_records.manage", "leaves.manage", "teachers.manage", "reports.manage", "ai.use"],
  advisor: ["dashboard.view", "students.own.view", "reports.own.manage", "credits.manage", "ai.use"],
  teacher: ["dashboard.view", "schedules.own.view", "lesson_records.own.submit", "homework.own.manage"],
  finance: ["dashboard.view", "credits.manage", "finance.manage"],
};

function stableId(...parts: Array<string | number>) {
  const hash = createHash("sha1").update(parts.join(":")).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function time(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

async function ensurePermissions() {
  for (const [code, name, module] of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name, module },
      update: { name, module },
    });
  }
  return new Map((await prisma.permission.findMany()).map((permission) => [permission.code, permission.id]));
}

async function seedOrganization(org: DemoOrg, permissionByCode: Map<string, string>) {
  const orgId = stableId("org", org.code);
  await prisma.organization.upsert({
    where: { code: org.code },
    create: { id: orgId, name: org.name, code: org.code, status: "active" },
    update: { name: org.name, status: "active" },
  });

  await prisma.organizationSetting.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      shortName: org.name,
      phone: "010-6000-0000",
      email: `demo@${org.suffix}`,
      address: `${org.name}演示校区`,
      logoText: org.name,
      version: "v0.4.5",
      environment: "staging",
      academicConfig: { lowCreditThreshold: 5, defaultLessonHours: 2, allowCreditOverdraft: false, enableConflictDetection: true, enableLeaveApproval: true, enableReportReview: true },
      notificationConfig: { enableParentNotification: true, enableTeacherReminder: true, enableAdvisorRenewalReminder: true, channels: ["wecom", "email"] },
      aiConfig: { mode: "rule_based", enableAssistant: true, enableRenewalSuggestion: true, enableReportPolish: true, apiKeyStatus: "后续配置" },
    },
    update: {
      shortName: org.name,
      email: `demo@${org.suffix}`,
      environment: "staging",
    },
  });

  const users = new Map<string, string>();
  for (const config of roleConfigs) {
    const userId = stableId(org.code, "user", config.key);
    const email = `${config.email}@${org.suffix}`;
    await prisma.user.upsert({
      where: { email },
      create: {
        id: userId,
        organizationId: orgId,
        email,
        passwordHash: hashPassword(config.password),
        displayName: `${org.name}${config.name}`,
        role: config.role,
        status: UserStatus.ACTIVE,
      },
      update: {
        organizationId: orgId,
        displayName: `${org.name}${config.name}`,
        role: config.role,
        status: UserStatus.ACTIVE,
        passwordHash: hashPassword(config.password),
      },
    });
    users.set(config.key, userId);

    const roleId = stableId(org.code, "role", config.key);
    const code = roleCode(config.role);
    await prisma.role.upsert({
      where: { organizationId_code: { organizationId: orgId, code } },
      create: { id: roleId, organizationId: orgId, code, name: config.name },
      update: { name: config.name },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
    for (const code of rolePermissions[config.key]) {
      const permissionId = permissionByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        create: { roleId, permissionId },
        update: {},
      });
    }
  }

  const teacherIds: string[] = [];
  for (const [index, name] of org.teachers.entries()) {
    const teacherId = stableId(org.code, "teacher", index);
    teacherIds.push(teacherId);
    await prisma.teacher.upsert({
      where: { id: teacherId },
      create: {
        id: teacherId,
        organizationId: orgId,
        userId: index === 0 ? users.get("teacher") : null,
        name,
        subjects: [org.courses[index % org.courses.length].name],
        type: index === 0 ? TeacherType.FULL_TIME : TeacherType.PART_TIME,
        rating: 4.8,
        feedbackRate: 92,
        availableTime: ["周一 10:00-12:00", "周三 14:00-16:00"],
        status: "active",
      },
      update: {
        organizationId: orgId,
        userId: index === 0 ? users.get("teacher") : null,
        name,
        subjects: [org.courses[index % org.courses.length].name],
        status: "active",
      },
    });
  }

  const courseIds: string[] = [];
  for (const [index, course] of org.courses.entries()) {
    const courseId = stableId(org.code, "course", index);
    courseIds.push(courseId);
    await prisma.course.upsert({
      where: { id: courseId },
      create: {
        id: courseId,
        organizationId: orgId,
        name: course.name,
        category: course.category,
        level: course.level,
        totalLessons: 30,
        price: 12800 + index * 2000,
        teachingMethod: index === 0 ? "小班课" : "一对一",
        targetGrades: ["9年级", "10年级", "11年级"],
        responsibleTeacherId: teacherIds[index % teacherIds.length],
        description: `${org.name}演示课程：${course.name}`,
        status: CourseStatus.ACTIVE,
      },
      update: {
        organizationId: orgId,
        name: course.name,
        category: course.category,
        level: course.level,
        responsibleTeacherId: teacherIds[index % teacherIds.length],
        status: CourseStatus.ACTIVE,
      },
    });
  }

  const classId = stableId(org.code, "class", 0);
  await prisma.class.upsert({
    where: { id: classId },
    create: {
      id: classId,
      organizationId: orgId,
      name: `${org.name}演示小班`,
      courseId: courseIds[0],
      teacherId: teacherIds[0],
      scheduleDesc: "每周二 10:00-12:00",
      capacity: 8,
      enrolledCount: org.students.length,
      classroom: "Demo Room 101",
      status: "active",
    },
    update: {
      organizationId: orgId,
      name: `${org.name}演示小班`,
      courseId: courseIds[0],
      teacherId: teacherIds[0],
      enrolledCount: org.students.length,
      status: "active",
    },
  });

  const studentIds: string[] = [];
  for (const [index, name] of org.students.entries()) {
    const studentId = stableId(org.code, "student", index);
    studentIds.push(studentId);
    await prisma.student.upsert({
      where: { phone: `17${String(Math.abs(parseInt(stableId(org.code, "phone", index).slice(0, 9), 16))).slice(0, 9).padStart(9, "0")}` },
      create: {
        id: studentId,
        organizationId: orgId,
        name,
        phone: `17${String(Math.abs(parseInt(stableId(org.code, "phone", index).slice(0, 9), 16))).slice(0, 9).padStart(9, "0")}`,
        grade: ["9年级", "10年级", "11年级"][index],
        school: `${org.name}合作学校`,
        riskStatus: index === 0 ? StudentRiskStatus.HIGH : index === 1 ? StudentRiskStatus.NORMAL : StudentRiskStatus.LOW,
        tags: index === 0 ? ["低课时", "续费关注"] : ["演示学生"],
        advisorId: users.get("advisor"),
        recentTestScore: 82 + index * 3,
        targetCountry: org.code === "guangwai" ? "英国" : "美国",
        targetDirection: index === 0 ? "本科申请" : "标化提升",
        parentPhone: `18${String(Math.abs(parseInt(stableId(org.code, "parent", index).slice(0, 9), 16))).slice(0, 9).padStart(9, "0")}`,
        aiLearningSummary: `${name}是${org.name}演示学生，可用于多机构隔离测试。`,
        homeworkOverdueWarning: index === 0 ? "近期需要顾问跟进续课和作业完成情况。" : null,
      },
      update: {
        organizationId: orgId,
        name,
        advisorId: users.get("advisor"),
        riskStatus: index === 0 ? StudentRiskStatus.HIGH : index === 1 ? StudentRiskStatus.NORMAL : StudentRiskStatus.LOW,
        deletedAt: null,
      },
    });
    await prisma.classEnrollment.upsert({
      where: { classId_studentId: { classId, studentId } },
      create: { organizationId: orgId, classId, studentId, status: "active" },
      update: { organizationId: orgId, status: "active" },
    });
  }

  const accountId = stableId(org.code, "credit-account", 0);
  await prisma.creditAccount.upsert({
    where: { studentId_courseId: { studentId: studentIds[0], courseId: courseIds[0] } },
    create: {
      id: accountId,
      organizationId: orgId,
      studentId: studentIds[0],
      courseId: courseIds[0],
      balance: 3,
      totalPurchased: 24,
      totalConsumed: 21,
      lowBalance: true,
    },
    update: {
      organizationId: orgId,
      balance: 3,
      totalPurchased: 24,
      totalConsumed: 21,
      lowBalance: true,
      status: "active",
    },
  });

  await prisma.creditTransaction.upsert({
    where: { id: stableId(org.code, "credit-transaction", 0) },
    create: {
      id: stableId(org.code, "credit-transaction", 0),
      organizationId: orgId,
      accountId,
      studentId: studentIds[0],
      courseId: courseIds[0],
      adjustType: CreditAdjustType.PURCHASE,
      creditsDelta: 24,
      balanceBefore: 0,
      balanceAfter: 24,
      amount: 12800,
      status: CreditTransactionStatus.PAID,
      courseName: org.courses[0].name,
      notes: `${org.name}演示购买课时`,
      transactionDate: date("2026-07-01"),
      createdBy: users.get("finance"),
    },
    update: { balanceAfter: 24, notes: `${org.name}演示购买课时` },
  });

  const scheduleIds: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const scheduleId = stableId(org.code, "schedule", index);
    scheduleIds.push(scheduleId);
    await prisma.schedule.upsert({
      where: { id: scheduleId },
      create: {
        id: scheduleId,
        organizationId: orgId,
        courseId: courseIds[index % courseIds.length],
        teacherId: teacherIds[index % teacherIds.length],
        classId,
        studentId: index === 2 ? studentIds[0] : null,
        title: org.courses[index % org.courses.length].name,
        eventType: ScheduleEventType.CLASS,
        lessonDate: date(`2026-07-0${index + 6}`),
        startTime: time(`${10 + index}:00`),
        endTime: time(`${12 + index}:00`),
        durationHours: 2,
        classroom: `Demo Room ${index + 1}`,
        status: index === 2 ? ScheduleStatus.MAKEUP_PENDING : ScheduleStatus.SCHEDULED,
        createdBy: users.get("academic"),
      },
      update: {
        organizationId: orgId,
        title: org.courses[index % org.courses.length].name,
        classroom: `Demo Room ${index + 1}`,
        status: index === 2 ? ScheduleStatus.MAKEUP_PENDING : ScheduleStatus.SCHEDULED,
      },
    });
  }

  const lessonId = stableId(org.code, "lesson-record", 0);
  await prisma.lessonRecord.upsert({
    where: { id: lessonId },
    create: {
      id: lessonId,
      organizationId: orgId,
      scheduleId: scheduleIds[0],
      courseId: courseIds[0],
      classId,
      studentId: studentIds[0],
      teacherId: teacherIds[0],
      lessonDate: date("2026-07-06"),
      startTime: time("10:00"),
      endTime: time("12:00"),
      classroom: "Demo Room 1",
      durationHours: 2,
      topic: `${org.courses[0].name}阶段复盘`,
      attendance: LessonAttendance.PRESENT,
      status: LessonStatus.COMPLETED,
      feedbackStatus: LessonFeedbackStatus.SUBMITTED,
      creditsConsumed: 2,
      performance: "课堂参与积极，能完成随堂练习。",
      homework: "完成课后练习并整理错题。",
      aiSummary: "本节课学习状态稳定，建议继续保持练习频率。",
      deductionStatus: LessonDeductionStatus.DEDUCTED,
      needAdvisorFollowUp: true,
      syncToParent: true,
      deductedAt: new Date(),
    },
    update: {
      organizationId: orgId,
      status: LessonStatus.COMPLETED,
      feedbackStatus: LessonFeedbackStatus.SUBMITTED,
      deductionStatus: LessonDeductionStatus.DEDUCTED,
      needAdvisorFollowUp: true,
    },
  });

  await prisma.creditTransaction.upsert({
    where: { id: stableId(org.code, "credit-transaction", 1) },
    create: {
      id: stableId(org.code, "credit-transaction", 1),
      organizationId: orgId,
      accountId,
      studentId: studentIds[0],
      courseId: courseIds[0],
      lessonRecordId: lessonId,
      adjustType: CreditAdjustType.LESSON_DEDUCT,
      creditsDelta: -2,
      balanceBefore: 5,
      balanceAfter: 3,
      amount: 0,
      status: CreditTransactionStatus.PAID,
      courseName: org.courses[0].name,
      notes: `${org.name}演示消课扣减`,
      transactionDate: date("2026-07-06"),
      createdBy: users.get("academic"),
    },
    update: { balanceBefore: 5, balanceAfter: 3, notes: `${org.name}演示消课扣减` },
  });

  await prisma.lessonRecord.upsert({
    where: { id: stableId(org.code, "lesson-record", 1) },
    create: {
      id: stableId(org.code, "lesson-record", 1),
      organizationId: orgId,
      scheduleId: scheduleIds[1],
      courseId: courseIds[1],
      classId,
      studentId: studentIds[1],
      teacherId: teacherIds[1],
      lessonDate: date("2026-07-07"),
      startTime: time("11:00"),
      endTime: time("13:00"),
      classroom: "Demo Room 2",
      durationHours: 2,
      topic: `${org.courses[1].name}课堂练习`,
      attendance: LessonAttendance.PRESENT,
      status: LessonStatus.PENDING_FEEDBACK,
      feedbackStatus: LessonFeedbackStatus.PENDING,
      creditsConsumed: 0,
      performance: "待老师提交课后反馈。",
      deductionStatus: LessonDeductionStatus.PENDING,
    },
    update: {
      organizationId: orgId,
      status: LessonStatus.PENDING_FEEDBACK,
      feedbackStatus: LessonFeedbackStatus.PENDING,
      deductionStatus: LessonDeductionStatus.PENDING,
    },
  });

  await prisma.leaveMakeupRequest.upsert({
    where: { id: stableId(org.code, "leave-makeup", 0) },
    create: {
      id: stableId(org.code, "leave-makeup", 0),
      organizationId: orgId,
      scheduleId: scheduleIds[2],
      studentId: studentIds[0],
      classId,
      courseId: courseIds[0],
      teacherId: teacherIds[0],
      requestType: LeaveRequestType.STUDENT_LEAVE,
      originalDate: date("2026-07-08"),
      originalStartTime: time("12:00"),
      originalEndTime: time("14:00"),
      reason: "学生参加校内活动，申请补课",
      needMakeup: true,
      status: LeaveRequestStatus.PENDING,
      createdBy: users.get("advisor"),
    },
    update: {
      organizationId: orgId,
      reason: "学生参加校内活动，申请补课",
      status: LeaveRequestStatus.PENDING,
      parentNotified: false,
    },
  });

  await prisma.parentReport.upsert({
    where: { id: stableId(org.code, "parent-report", 0) },
    create: {
      id: stableId(org.code, "parent-report", 0),
      organizationId: orgId,
      studentId: studentIds[0],
      courseId: courseIds[0],
      advisorId: users.get("advisor"),
      reportType: ParentReportType.MONTHLY,
      title: `${org.name}7月学习报告`,
      summary: `${org.students[0]}近期学习节奏稳定，但课时余额偏低，建议顾问跟进续课。`,
      courseProgress: `${org.courses[0].name}已完成阶段复盘。`,
      lessonSummary: "本月完成 2 次课程，其中 1 次已完成消课。",
      teacherFeedbackSummary: "老师反馈课堂参与度良好，作业质量需要继续稳定。",
      homeworkSummary: "作业基本按时完成。",
      attendanceSummary: "出勤稳定，有 1 条请假补课待处理。",
      creditSummary: "当前剩余 3 课时，已触发低课时预警。",
      leaveMakeupSummary: "存在 1 条待审批补课申请。",
      nextStepPlan: "建议本周完成续课沟通，并安排补课时间。",
      parentVisibleContent: "近期学习状态稳定，建议继续保持课堂节奏，并提前规划后续课时。",
      periodLabel: "2026年7月学习报告",
      periodStart: date("2026-07-01"),
      periodEnd: date("2026-07-31"),
      studentName: org.students[0],
      grade: "10年级",
      coursesSummary: org.courses[0].name,
      monthlyHours: 4,
      attendanceRate: 95,
      homeworkRate: 88,
      scoreImprovement: 4,
      courseRecords: [{ date: "2026-07-06", course: org.courses[0].name, teacher: org.teachers[0], feedback: "学习状态稳定。" }],
      aiSummary: "建议家长关注课时余额并配合补课安排。",
      status: ParentReportStatus.GENERATED,
      generatedAt: new Date(),
      createdBy: users.get("advisor"),
    },
    update: {
      organizationId: orgId,
      summary: `${org.students[0]}近期学习节奏稳定，但课时余额偏低，建议顾问跟进续课。`,
      status: ParentReportStatus.GENERATED,
    },
  });

  await prisma.importLog.upsert({
    where: { id: stableId(org.code, "import-log", 0) },
    create: {
      id: stableId(org.code, "import-log", 0),
      organizationId: orgId,
      importType: "students",
      fileName: `${org.name}演示学员导入.xlsx`,
      totalRows: 3,
      successRows: 3,
      failedRows: 0,
      status: "imported",
      result: { rows: org.students.map((name, index) => ({ rowNumber: index + 2, status: "valid", data: { name } })), createdIds: studentIds.map((id) => ({ type: "student", id })) },
      createdBy: users.get("admin"),
      importedAt: new Date(),
    },
    update: { organizationId: orgId, totalRows: 3, successRows: 3, failedRows: 0, status: "imported" },
  });
}

async function main() {
  const permissionByCode = await ensurePermissions();
  for (const org of demoOrgs) {
    await seedOrganization(org, permissionByCode);
  }
  console.log("Demo organizations seeded:", demoOrgs.map((org) => org.code).join(", "));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
