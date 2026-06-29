import "dotenv/config";
import {
  AiMessageRole,
  AiQueryIntent,
  AiTaskStatus,
  AiTaskType,
  CourseCategory,
  CourseStatus,
  CreditAdjustType,
  CreditTransactionStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  LessonAttendance,
  LessonFeedbackStatus,
  LessonStatus,
  ParentReportStatus,
  PrismaClient,
  ScheduleEventType,
  ScheduleStatus,
  StudentRiskStatus,
  TeacherType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const orgId = "01000000-0000-0000-0000-000000000001";
const userIds = {
  admin: "00000000-0000-0000-0000-000000000001",
  manager: "00000000-0000-0000-0000-000000000004",
  advisor: "00000000-0000-0000-0000-000000000002",
  teacher: "00000000-0000-0000-0000-000000000003",
  finance: "00000000-0000-0000-0000-000000000005",
};

function id(prefix: string, index: number) {
  return `${prefix}${String(index).padStart(12, "0")}`.replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    "$1-$2-$3-$4-$5"
  );
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function time(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

async function resetData() {
  await prisma.uploadedFile.deleteMany();
  await prisma.importLog.deleteMany();
  await prisma.operationLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.competitionProject.deleteMany();
  await prisma.aiTask.deleteMany();
  await prisma.aiMessage.deleteMany();
  await prisma.parentReport.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.lessonRecord.deleteMany();
  await prisma.leaveMakeupRequest.deleteMany();
  await prisma.leaveRecord.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.classEnrollment.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.class.deleteMany();
  await prisma.room.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function main() {
  await resetData();

  await prisma.organization.create({
    data: { id: orgId, name: "朗睿教育", code: "liangrui-education" },
  });

  await prisma.user.createMany({
    data: [
      { id: userIds.admin, organizationId: orgId, email: "admin@longrui.com", passwordHash: "admin123", displayName: "朗睿管理员", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      { id: userIds.manager, organizationId: orgId, email: "academic@longrui.com", passwordHash: "academic123", displayName: "教务主管", role: UserRole.ACADEMIC_MANAGER, status: UserStatus.ACTIVE },
      { id: userIds.advisor, organizationId: orgId, email: "advisor@longrui.com", passwordHash: "advisor123", displayName: "朗睿顾问", role: UserRole.ADVISOR, status: UserStatus.ACTIVE },
      { id: userIds.teacher, organizationId: orgId, email: "teacher@longrui.com", passwordHash: "teacher123", displayName: "王建国", role: UserRole.TEACHER, status: UserStatus.ACTIVE },
      { id: userIds.finance, organizationId: orgId, email: "finance@longrui.com", passwordHash: "finance123", displayName: "财务老师", role: UserRole.FINANCE, status: UserStatus.ACTIVE },
    ],
  });

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

  await prisma.permission.createMany({
    data: permissionCodes.map(([code, name, module]) => ({ code, name, module })),
  });

  const roleDefinitions = [
    { code: "admin", name: "管理员", userId: userIds.admin, permissions: permissionCodes.map(([code]) => code) },
    {
      code: "academic_manager",
      name: "教务主管",
      userId: userIds.manager,
      permissions: ["dashboard.view", "students.manage", "courses.manage", "classes.manage", "schedules.manage", "lesson_records.manage", "leaves.manage", "teachers.manage", "reports.manage", "ai.use"],
    },
    {
      code: "advisor",
      name: "顾问",
      userId: userIds.advisor,
      permissions: ["dashboard.view", "students.own.view", "reports.own.manage", "credits.manage", "ai.use"],
    },
    {
      code: "teacher",
      name: "老师",
      userId: userIds.teacher,
      permissions: ["dashboard.view", "schedules.own.view", "lesson_records.own.submit", "homework.own.manage"],
    },
    {
      code: "finance",
      name: "财务",
      userId: userIds.finance,
      permissions: ["dashboard.view", "credits.manage", "finance.manage"],
    },
  ];

  const permissions = await prisma.permission.findMany();
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  for (const item of roleDefinitions) {
    const role = await prisma.role.create({
      data: {
        organizationId: orgId,
        code: item.code,
        name: item.name,
      },
    });
    await prisma.userRoleAssignment.create({
      data: { userId: item.userId, roleId: role.id },
    });
    await prisma.rolePermission.createMany({
      data: item.permissions.map((code) => ({
        roleId: role.id,
        permissionId: permissionByCode.get(code)!,
      })),
    });
  }

  const teacherNames = ["王建国", "李老师", "Sarah Chen", "赵明", "Emily Wang", "陈思远", "Anna Liu", "周航", "Michael Zhang", "刘佳"];
  const teacherIds = teacherNames.map((_, i) => id("10000000000000000000", i + 1));
  await prisma.teacher.createMany({
    data: teacherNames.map((name, index) => ({
      id: teacherIds[index],
      organizationId: orgId,
      userId: index === 0 ? userIds.teacher : undefined,
      name,
      subjects: index % 3 === 0 ? ["AP微积分", "数学竞赛"] : index % 3 === 1 ? ["托福", "英语写作"] : ["物理", "科研项目"],
      type: index % 2 === 0 ? TeacherType.FULL_TIME : TeacherType.PART_TIME,
      rating: 4.4 + (index % 5) * 0.1,
      classesCount: 1 + (index % 4),
      availableTime: ["周一 10:00-12:00", "周三 14:00-16:00", "周六 09:00-12:00"],
      feedbackRate: 82 + index,
    })),
  });

  const courseTemplates = [
    ["AP微积分BC", CourseCategory.MATH, "AP", 40, 19800],
    ["AP物理C力学", CourseCategory.PHYSICS, "AP", 36, 18800],
    ["AP化学强化", CourseCategory.CHEMISTRY, "AP", 34, 17800],
    ["托福写作强化", CourseCategory.ENGLISH, "TOEFL", 24, 12800],
    ["托福口语冲刺", CourseCategory.ENGLISH, "TOEFL", 20, 10800],
    ["AMC10竞赛班", CourseCategory.COMPETITION, "竞赛", 32, 16800],
    ["AIME冲刺营", CourseCategory.COMPETITION, "竞赛", 28, 15800],
    ["科研论文入门", CourseCategory.RESEARCH, "科研", 20, 22800],
    ["Python科研项目", CourseCategory.RESEARCH, "科研", 24, 23800],
    ["SAT数学高分", CourseCategory.MATH, "SAT", 18, 9800],
    ["IB数学AA HL", CourseCategory.MATH, "IB", 36, 19800],
    ["IG物理提升", CourseCategory.PHYSICS, "IGCSE", 30, 14800],
    ["国际化学竞赛基础", CourseCategory.CHEMISTRY, "竞赛", 32, 16800],
    ["学术英语阅读", CourseCategory.ENGLISH, "English", 20, 9800],
    ["藤校申请科研课", CourseCategory.RESEARCH, "申请", 16, 25800],
  ] as const;
  const courseIds = courseTemplates.map((_, i) => id("30000000000000000000", i + 1));
  await prisma.course.createMany({
    data: courseTemplates.map(([name, category, level, totalLessons, price], index) => ({
      id: courseIds[index],
      organizationId: orgId,
      name,
      category,
      level,
      totalLessons,
      price,
      description: `${name} · 朗睿教育 staging 演示课程`,
      teachingMethod: index % 2 === 0 ? "小班课" : "1v1",
      targetGrades: ["9年级", "10年级", "11年级"],
      responsibleTeacherId: teacherIds[index % teacherIds.length],
      syllabus: `${name} 课程大纲：入门评估、阶段讲解、专题训练、阶段测评、结课反馈。`,
      status: CourseStatus.ACTIVE,
    })),
  });

  const roomIds = [1, 2, 3, 4, 5].map((i) => id("50000000000000000000", i));
  await prisma.room.createMany({
    data: roomIds.map((roomId, index) => ({
      id: roomId,
      organizationId: orgId,
      code: `room-${index + 1}`,
      label: index === 4 ? "线上会议 (Zoom)" : `Room ${301 + index}`,
      capacity: index === 4 ? 20 : 8 + index * 2,
    })),
  });

  const classIds = [1, 2, 3, 4, 5].map((i) => id("40000000000000000000", i));
  await prisma.class.createMany({
    data: classIds.map((classId, index) => ({
      id: classId,
      organizationId: orgId,
      name: ["AP微积分BC A班", "托福写作 1v1", "AMC10竞赛班", "科研论文项目班", "AP物理C周末班"][index],
      courseId: courseIds[[0, 3, 5, 7, 1][index]],
      teacherId: teacherIds[index],
      scheduleDesc: ["周六 10:00-12:00", "周二 15:00-17:00", "周日 09:00-11:00", "周三 19:00-21:00", "周六 14:00-16:00"][index],
      capacity: [8, 1, 10, 6, 8][index],
      enrolledCount: [8, 1, 10, 6, 5][index],
      classroom: index === 3 ? "线上会议 (Zoom)" : `Room ${301 + index}`,
    })),
  });

  const studentNames = [
    "张子涵", "李佳怡", "王宇航", "赵诗琪", "刘星宇", "陈雨桐", "周明轩", "吴思远", "郑可欣", "孙浩然",
    "胡嘉怡", "朱一诺", "林子墨", "何雨泽", "高欣怡", "罗天佑", "梁语嫣", "宋梓涵", "唐铭轩", "许若曦",
    "韩沐阳", "冯诗涵", "邓宇辰", "曹安琪", "彭俊熙", "曾可乐", "袁思齐", "董奕辰", "谢安然", "姜亦凡",
  ];
  const studentIds = studentNames.map((_, i) => id("20000000000000000000", i + 1));
  await prisma.student.createMany({
    data: studentNames.map((name, index) => {
      const remaining = [2, 5, 8, 12, 18, 24, 30, 36][index % 8];
      return {
        id: studentIds[index],
        organizationId: orgId,
        name,
        phone: `138${String(index + 1).padStart(8, "0")}`,
        grade: ["9年级", "10年级", "11年级", "12年级"][index % 4],
        school: ["人大附中", "十一学校", "平和双语", "清华附中", "北师大附属"][index % 5],
        riskStatus: remaining <= 5 ? StudentRiskStatus.HIGH : remaining <= 10 ? StudentRiskStatus.MEDIUM : StudentRiskStatus.LOW,
        tags: index % 3 === 0 ? ["AP", "竞赛苗子"] : index % 3 === 1 ? ["托福", "续费关注"] : ["科研", "基础提升"],
        enrollmentDate: date(`2024-${String((index % 9) + 1).padStart(2, "0")}-0${(index % 8) + 1}`),
        advisorId: userIds.advisor,
        recentTestScore: 72 + (index % 28),
        aiLearningSummary: `${name}近期学习节奏稳定，建议保持每周复盘。`,
        homeworkOverdueWarning: index % 7 === 0 ? "存在作业逾期风险，建议顾问跟进。" : undefined,
      };
    }),
  });

  await prisma.classEnrollment.createMany({
    data: studentIds.map((studentId, index) => ({
      organizationId: orgId,
      studentId,
      classId: classIds[index % classIds.length],
      status: "active",
    })),
  });

  const accounts = await Promise.all(studentIds.map((studentId, index) => {
    const balance = [2, 5, 8, 12, 18, 24, 30, 36][index % 8];
    return prisma.creditAccount.create({
      data: {
        organizationId: orgId,
        studentId,
        balance,
        totalPurchased: balance + 20,
        totalConsumed: 20,
      },
    });
  }));

  await prisma.creditTransaction.createMany({
    data: Array.from({ length: 20 }).map((_, index) => {
      const studentIndex = index % studentIds.length;
      const isDeduct = index >= 12;
      const delta = isDeduct ? -2 : [12, 16, 20, 24][index % 4];
      return {
        organizationId: orgId,
        accountId: accounts[studentIndex].id,
        studentId: studentIds[studentIndex],
        courseId: courseIds[index % courseIds.length],
        adjustType: isDeduct ? CreditAdjustType.LESSON_DEDUCT : CreditAdjustType.PURCHASE,
        creditsDelta: delta,
        balanceAfter: Number(accounts[studentIndex].balance) + delta,
        amount: isDeduct ? 0 : 9800 + (index % 5) * 2000,
        status: index % 6 === 0 ? CreditTransactionStatus.PENDING : CreditTransactionStatus.PAID,
        courseName: courseTemplates[index % courseTemplates.length][0],
        notes: isDeduct ? "演示消课扣减" : "演示购买课时",
        transactionDate: date(`2026-06-${String((index % 20) + 1).padStart(2, "0")}`),
        createdBy: userIds.finance,
      };
    }),
  });

  await prisma.schedule.createMany({
    data: Array.from({ length: 30 }).map((_, index) => {
      const hour = 9 + (index % 6) * 2;
      return {
        id: id("60000000000000000000", index + 1),
        organizationId: orgId,
        courseId: courseIds[index % courseIds.length],
        teacherId: teacherIds[index % teacherIds.length],
        classId: classIds[index % classIds.length],
        roomId: roomIds[index % roomIds.length],
        title: courseTemplates[index % courseTemplates.length][0],
        eventType: ScheduleEventType.CLASS,
        lessonDate: date(`2026-06-${String((index % 14) + 16).padStart(2, "0")}`),
        startTime: time(`${String(hour).padStart(2, "0")}:00`),
        endTime: time(`${String(hour + 2).padStart(2, "0")}:00`),
        durationHours: 2,
        status: index % 10 === 0 ? ScheduleStatus.CANCELLED : ScheduleStatus.SCHEDULED,
        hasConflict: index % 13 === 0,
        createdBy: userIds.manager,
      };
    }),
  });

  await prisma.lessonRecord.createMany({
    data: Array.from({ length: 20 }).map((_, index) => ({
      id: id("70000000000000000000", index + 1),
      organizationId: orgId,
      scheduleId: id("60000000000000000000", (index % 20) + 1),
      classId: classIds[index % classIds.length],
      studentId: studentIds[index % studentIds.length],
      teacherId: teacherIds[index % teacherIds.length],
      lessonDate: date(`2026-06-${String((index % 20) + 1).padStart(2, "0")}`),
      topic: ["函数极限", "托福综合写作", "力学动量", "科研选题", "竞赛数论"][index % 5],
      attendance: index % 9 === 0 ? LessonAttendance.STUDENT_LEAVE : LessonAttendance.PRESENT,
      status: index % 4 === 0 ? LessonStatus.SCHEDULED : LessonStatus.COMPLETED,
      feedbackStatus: index % 3 === 0 ? LessonFeedbackStatus.PENDING : LessonFeedbackStatus.SUBMITTED,
      creditsConsumed: 2,
      performance: "课堂参与度良好，能主动提问并完成随堂练习。",
      homework: index % 7 === 0 ? undefined : "完成本节课配套练习并上传作业。",
      aiSummary: index % 3 === 0 ? undefined : "本节课掌握情况良好，建议继续保持练习频率。",
      homeworkDueAt: date(`2026-06-${String((index % 20) + 3).padStart(2, "0")}`),
      homeworkSubmittedAt: index % 7 === 0 ? undefined : date(`2026-06-${String((index % 20) + 4).padStart(2, "0")}`),
    })),
  });

  await prisma.leaveRecord.createMany({
    data: Array.from({ length: 10 }).map((_, index) => ({
      organizationId: orgId,
      type: [LeaveRequestType.STUDENT_LEAVE, LeaveRequestType.TEACHER_LEAVE, LeaveRequestType.RESCHEDULE, LeaveRequestType.MAKEUP][index % 4],
      studentId: studentIds[index],
      teacherId: teacherIds[index % teacherIds.length],
      classId: classIds[index % classIds.length],
      originalDate: date(`2026-06-${String(index + 5).padStart(2, "0")}`),
      makeupDate: index % 2 === 0 ? date(`2026-06-${String(index + 18).padStart(2, "0")}`) : undefined,
      reason: ["学生竞赛冲突", "老师临时教研", "家庭出行", "考试冲突"][index % 4],
      deductCredit: index % 3 === 0,
      status: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED, LeaveRequestStatus.MAKEUP_SCHEDULED, LeaveRequestStatus.MAKEUP_COMPLETED][index % 4],
      notifyStatus: index % 2 === 0 ? "notified" : "pending",
    })),
  });

  await prisma.parentReport.createMany({
    data: Array.from({ length: 5 }).map((_, index) => ({
      organizationId: orgId,
      studentId: studentIds[index],
      advisorId: userIds.advisor,
      periodLabel: "2026年6月学习报告",
      periodStart: date("2026-06-01"),
      periodEnd: date("2026-06-30"),
      studentName: studentNames[index],
      grade: ["9年级", "10年级", "11年级", "12年级"][index % 4],
      coursesSummary: courseTemplates[index][0],
      monthlyHours: 8 + index * 2,
      attendanceRate: 92 + index,
      homeworkRate: 82 + index * 2,
      scoreImprovement: 3 + index,
      courseRecords: [
        { date: "2026-06-10", course: courseTemplates[index][0], topic: "阶段复盘", teacher: teacherNames[index], feedback: "学习状态稳定，建议继续强化错题整理。" },
      ],
      aiSummary: `${studentNames[index]}本月学习节奏稳定，建议家长继续关注课后作业完成质量。`,
      status: index === 0 ? ParentReportStatus.SENT : ParentReportStatus.GENERATED,
      generatedAt: new Date(),
      sentAt: index === 0 ? new Date() : undefined,
      sentChannel: index === 0 ? "wecom" : undefined,
      createdBy: userIds.advisor,
    })),
  });

  await prisma.aiMessage.createMany({
    data: [
      "低课时学生预警：李佳怡等 4 名学生低于 5 课时。",
      "老师反馈提醒：6 条上课记录待提交反馈。",
      "作业逾期提醒：3 名学生作业存在延期风险。",
      "续费跟进建议：AP微积分班 2 名学生建议本周沟通。",
      "家长报告提醒：5 份月度报告待确认发送。",
    ].map((content, index) => ({
      organizationId: orgId,
      userId: userIds.admin,
      sessionId: id("90000000000000000000", index + 1),
      role: AiMessageRole.ASSISTANT,
      content,
      intent: [AiQueryIntent.CREDIT_WARNING, AiQueryIntent.DEFAULT, AiQueryIntent.DEFAULT, AiQueryIntent.REPORT, AiQueryIntent.REPORT][index],
      structuredResult: { reminder: content },
    })),
  });

  await prisma.aiTask.createMany({
    data: Array.from({ length: 5 }).map((_, index) => ({
      organizationId: orgId,
      taskType: [AiTaskType.CHAT, AiTaskType.LESSON_FEEDBACK, AiTaskType.RENEWAL_SUGGESTION, AiTaskType.PARENT_REPORT_SUMMARY, AiTaskType.LEARNING_SUMMARY][index],
      status: AiTaskStatus.COMPLETED,
      userId: userIds.admin,
      studentId: studentIds[index],
      inputPayload: { source: "staging_seed" },
      outputPayload: { message: `AI 教务提醒 ${index + 1}` },
      completedAt: new Date(),
    })),
  });

  await prisma.operationLog.createMany({
    data: [
      { action: "create_student", resourceType: "student", resourceId: studentIds[0], detail: { name: studentNames[0] } },
      { action: "create_schedule", resourceType: "schedule", resourceId: id("60000000000000000000", 1), detail: { course: courseTemplates[0][0] } },
      { action: "deduct_credit", resourceType: "lesson_record", resourceId: id("70000000000000000000", 2), detail: { credits: 2 } },
      { action: "adjust_credit", resourceType: "credit_transaction", detail: { credits: 20 } },
      { action: "send_parent_report", resourceType: "parent_report", detail: { channel: "wecom" } },
    ].map((item) => ({
      organizationId: orgId,
      userId: userIds.admin,
      ...item,
    })),
  });
}

main()
  .then(async () => {
    console.log("Seed completed");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
