import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import {
  CourseCategory,
  CourseStatus,
  CreditAdjustType,
  CreditTransactionStatus,
  LessonAttendance,
  LessonDeductionStatus,
  LessonFeedbackStatus,
  LessonStatus,
  Prisma,
  ScheduleStatus,
  TeacherType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, importPreviewSchema, importTypeParamSchema } from "../validators/schemas.js";
import { logOperation } from "../lib/operationLog.js";
import type { MockUser } from "../middleware/auth.js";

export const importsRouter = Router();
export const exportsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

type ImportType = "students" | "courses" | "teachers" | "classes" | "credit-balances" | "schedules" | "lesson-records";
type ExportType =
  | "students"
  | "courses"
  | "teachers"
  | "classes"
  | "credit-accounts"
  | "credit-transactions"
  | "schedules"
  | "lesson-records"
  | "leave-makeup"
  | "parent-reports";
type RowData = Record<string, unknown>;
type PreviewRow = {
  rowNumber: number;
  status: "valid" | "invalid";
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawData: RowData;
  normalizedData: RowData;
  data: RowData;
};

const importTemplates: Record<ImportType, string[]> = {
  students: ["学员姓名", "手机号", "年级", "当前学校", "目标国家", "目标方向", "负责顾问", "家长姓名", "家长电话", "标签", "风险状态", "备注"],
  courses: ["课程名称", "课程类别", "授课方式", "总课时", "标准价格", "适合年级", "负责老师", "状态", "课程简介", "课程大纲"],
  teachers: ["老师姓名", "手机号", "邮箱", "老师类型", "擅长科目", "可授课程", "可用时间", "状态", "备注"],
  classes: ["班级名称", "关联课程", "主讲老师", "上课时间", "教室", "容量", "状态", "备注"],
  "credit-balances": ["学员姓名", "手机号", "课程名称", "已购买课时", "已消耗课时", "剩余课时", "赠送课时", "冻结课时", "备注"],
  schedules: ["学员姓名", "班级名称", "课程名称", "老师姓名", "上课日期", "开始时间", "结束时间", "教室", "状态", "备注"],
  "lesson-records": ["学员姓名", "班级名称", "课程名称", "老师姓名", "上课日期", "开始时间", "结束时间", "本节课时", "课堂内容", "学生表现", "作业布置", "老师反馈", "状态", "是否已消课", "备注"],
};

const importTypeLabels: Record<ImportType, string> = {
  students: "学员导入",
  courses: "课程导入",
  teachers: "老师导入",
  classes: "班级导入",
  "credit-balances": "课时余额导入",
  schedules: "历史排课导入",
  "lesson-records": "历史上课记录导入",
};

function assertImportType(value: string): ImportType {
  if (value === "credits") return "credit-balances";
  if (value in importTemplates) return value as ImportType;
  throw badRequest("不支持的导入类型");
}

function assertExportType(value: string): ExportType {
  const exportTypes: ExportType[] = [
    "students",
    "courses",
    "teachers",
    "classes",
    "credit-accounts",
    "credit-transactions",
    "schedules",
    "lesson-records",
    "leave-makeup",
    "parent-reports",
  ];
  if (value === "credits") return "credit-transactions";
  if (exportTypes.includes(value as ExportType)) return value as ExportType;
  throw badRequest("不支持的导出类型");
}

function canImport(user: MockUser, type: ImportType) {
  if (user.role === "admin") return true;
  if (user.role === "academic_manager") return type !== "credit-balances";
  if (user.role === "finance") return type === "credit-balances";
  return false;
}

function allowedImportTypes(user: MockUser) {
  return (Object.keys(importTemplates) as ImportType[]).filter((type) => canImport(user, type));
}

function canExport(user: MockUser, type: ExportType) {
  if (user.role === "admin") return true;
  if (user.role === "academic_manager") return !["credit-accounts", "credit-transactions"].includes(type);
  if (user.role === "finance") return ["credit-accounts", "credit-transactions"].includes(type);
  if (user.role === "advisor") return ["students", "credit-accounts", "credit-transactions", "schedules", "lesson-records", "leave-makeup", "parent-reports"].includes(type);
  if (user.role === "teacher") return ["schedules", "lesson-records"].includes(type);
  return false;
}

function assertImportPermission(user: MockUser, type: ImportType) {
  if (!canImport(user, type)) throw new AppError(403, "FORBIDDEN", "当前账号无权批量导入该类型数据");
}

function assertImportBatchAccess(user: MockUser, type: string) {
  assertImportPermission(user, assertImportType(type));
}

function assertExportPermission(user: MockUser, type: ExportType) {
  if (!canExport(user, type)) throw new AppError(403, "FORBIDDEN", "当前账号无权导出该类型数据");
}

function text(row: RowData, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

function numberValue(row: RowData, ...keys: string[]) {
  const value = text(row, ...keys);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolValue(row: RowData, ...keys: string[]) {
  const value = text(row, ...keys);
  if (!value) return undefined;
  return ["是", "true", "1", "yes", "y"].includes(value.toLowerCase());
}

function splitList(value?: string) {
  return value ? value.split(/[;；,，]/).map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeDateValue(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function dateText(row: RowData, ...keys: string[]) {
  return normalizeDateValue(text(row, ...keys));
}

function isTime(value?: string) {
  return Boolean(value && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value));
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeOnly(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

function durationHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60, 0);
}

function toStatusEnum<T extends Record<string, string>>(value: unknown, enumObject: T, fallback: keyof T) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[-\s]/g, "_");
  return (normalized in enumObject ? normalized : fallback) as keyof T;
}

function toCourseCategory(value?: string) {
  const map: Record<string, CourseCategory> = {
    数学: CourseCategory.MATH,
    物理: CourseCategory.PHYSICS,
    化学: CourseCategory.CHEMISTRY,
    英语: CourseCategory.ENGLISH,
    竞赛: CourseCategory.COMPETITION,
    科研: CourseCategory.RESEARCH,
    math: CourseCategory.MATH,
    physics: CourseCategory.PHYSICS,
    chemistry: CourseCategory.CHEMISTRY,
    english: CourseCategory.ENGLISH,
    competition: CourseCategory.COMPETITION,
    research: CourseCategory.RESEARCH,
  };
  return map[String(value ?? "math").trim()] ?? CourseCategory.MATH;
}

function toTeacherType(value?: string) {
  const normalized = String(value ?? "full-time").toLowerCase();
  return normalized.includes("part") || normalized.includes("兼职") ? TeacherType.PART_TIME : TeacherType.FULL_TIME;
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function parseRows(req: { file?: Express.Multer.File; body: any }): Promise<RowData[]> {
  if (req.file?.buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.text || cell.value || "").trim();
    });
    const rows: RowData[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: RowData = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber];
        if (!key) return;
        item[key] = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text || cell.value || "";
      });
      if (Object.values(item).some((value) => String(value ?? "").trim() !== "")) rows.push(item);
    });
    return rows;
  }
  return Array.isArray(req.body.rows) ? req.body.rows : [];
}

function normalize(type: ImportType, row: RowData) {
  if (type === "students") {
    return {
      name: text(row, "学员姓名", "姓名", "name"),
      phone: text(row, "手机号", "phone"),
      grade: text(row, "年级", "grade") ?? "10年级",
      school: text(row, "当前学校", "学校", "school"),
      targetCountry: text(row, "目标国家", "targetCountry"),
      targetDirection: text(row, "目标方向", "targetDirection"),
      advisorName: text(row, "负责顾问", "负责顾问姓名", "advisorName"),
      parentName: text(row, "家长姓名", "parentName"),
      parentPhone: text(row, "家长电话", "parentPhone"),
      tags: splitList(text(row, "标签", "tags")),
      riskStatus: text(row, "风险状态", "riskStatus") ?? "normal",
      notes: text(row, "备注", "notes"),
    };
  }
  if (type === "courses") {
    return {
      name: text(row, "课程名称", "name"),
      category: text(row, "课程类别", "课程分类", "category") ?? "math",
      teachingMethod: text(row, "授课方式", "teachingMethod"),
      totalLessons: numberValue(row, "总课时", "标准总课时", "totalLessons"),
      price: numberValue(row, "标准价格", "price") ?? 0,
      targetGrades: splitList(text(row, "适合年级", "适用年级", "targetGrades")),
      teacherName: text(row, "负责老师", "teacherName"),
      status: text(row, "状态", "status") ?? "active",
      description: text(row, "课程简介", "课程描述", "description"),
      syllabus: text(row, "课程大纲", "syllabus"),
      level: text(row, "级别", "level") ?? "基础",
    };
  }
  if (type === "teachers") {
    return {
      name: text(row, "老师姓名", "姓名", "name"),
      phone: text(row, "手机号", "phone"),
      email: text(row, "邮箱", "登录邮箱", "email"),
      type: text(row, "老师类型", "type") ?? "full-time",
      subjects: splitList(text(row, "擅长科目", "授课科目", "subjects")),
      teachableCourses: splitList(text(row, "可授课程", "courses")),
      availableTime: splitList(text(row, "可用时间", "availableTime")),
      status: text(row, "状态", "status") ?? "active",
      notes: text(row, "备注", "notes"),
    };
  }
  if (type === "classes") {
    return {
      name: text(row, "班级名称", "name"),
      courseName: text(row, "关联课程", "课程名称", "courseName"),
      teacherName: text(row, "主讲老师", "老师姓名", "teacherName"),
      scheduleText: text(row, "上课时间", "scheduleText"),
      classroom: text(row, "教室", "classroom"),
      capacity: numberValue(row, "容量", "capacity"),
      status: text(row, "状态", "status") ?? "active",
      notes: text(row, "备注", "notes"),
    };
  }
  if (type === "credit-balances") {
    const purchased = numberValue(row, "已购买课时", "totalPurchasedHours");
    const consumed = numberValue(row, "已消耗课时", "totalConsumedHours");
    const gifted = numberValue(row, "赠送课时", "giftedHours") ?? 0;
    const frozen = numberValue(row, "冻结课时", "frozenHours") ?? 0;
    return {
      studentName: text(row, "学员姓名", "studentName"),
      phone: text(row, "手机号", "phone"),
      courseName: text(row, "课程名称", "courseName"),
      totalPurchasedHours: purchased,
      totalConsumedHours: consumed,
      remainingHours: numberValue(row, "剩余课时", "remainingHours") ?? (purchased !== undefined && consumed !== undefined ? purchased + gifted - consumed - frozen : undefined),
      giftedHours: gifted,
      frozenHours: frozen,
      notes: text(row, "备注", "notes"),
    };
  }
  if (type === "schedules") {
    return {
      studentName: text(row, "学员姓名", "studentName"),
      className: text(row, "班级名称", "className"),
      courseName: text(row, "课程名称", "courseName"),
      teacherName: text(row, "老师姓名", "teacherName"),
      date: dateText(row, "上课日期", "date"),
      startTime: text(row, "开始时间", "startTime"),
      endTime: text(row, "结束时间", "endTime"),
      classroom: text(row, "教室", "classroom"),
      status: text(row, "状态", "status") ?? "scheduled",
      notes: text(row, "备注", "notes"),
    };
  }
  return {
    studentName: text(row, "学员姓名", "studentName"),
    className: text(row, "班级名称", "className"),
    courseName: text(row, "课程名称", "courseName"),
    teacherName: text(row, "老师姓名", "teacherName"),
    date: dateText(row, "上课日期", "date"),
    startTime: text(row, "开始时间", "startTime"),
    endTime: text(row, "结束时间", "endTime"),
    durationHours: numberValue(row, "本节课时", "durationHours"),
    topic: text(row, "课堂内容", "课程主题", "topic"),
    performance: text(row, "学生表现", "课堂表现", "performance"),
    homework: text(row, "作业布置", "homework"),
    feedback: text(row, "老师反馈", "feedback"),
    status: text(row, "状态", "status") ?? "completed",
    deducted: boolValue(row, "是否已消课", "deducted") ?? false,
    notes: text(row, "备注", "notes"),
  };
}

async function validateNormalized(type: ImportType, data: RowData, organizationId: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requireField = (field: string, label: string) => {
    if (!data[field]) errors.push(`${label}不能为空`);
  };

  if (type === "students") {
    requireField("name", "学员姓名");
    const phone = String(data.phone ?? "");
    if (phone && !/^1?\d{6,20}$/.test(phone)) errors.push("手机号格式不合理");
    if (data.advisorName) {
      const advisor = await prisma.user.findFirst({ where: { organizationId, displayName: String(data.advisorName) } });
      if (!advisor) warnings.push("负责顾问未匹配，将留空");
    }
    if (phone) {
      const duplicate = await prisma.student.findFirst({ where: { organizationId, phone, deletedAt: null } });
      if (duplicate) warnings.push("同手机号学员可能重复");
    }
    if (data.name && data.school) {
      const duplicate = await prisma.student.findFirst({ where: { organizationId, name: String(data.name), school: String(data.school), deletedAt: null } });
      if (duplicate) warnings.push("同姓名和学校学员可能重复");
    }
  } else if (type === "courses") {
    requireField("name", "课程名称");
    if (data.totalLessons === undefined) errors.push("总课时必须为数字");
    if (data.price !== undefined && !Number.isFinite(Number(data.price))) errors.push("标准价格必须为数字");
    if (data.name) {
      const duplicate = await prisma.course.findFirst({ where: { organizationId, name: String(data.name) } });
      if (duplicate) warnings.push("同名课程可能重复");
    }
  } else if (type === "teachers") {
    requireField("name", "老师姓名");
    const email = String(data.email ?? "");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("邮箱格式不合理");
    if (data.phone || email) {
      const duplicateUser = email ? await prisma.user.findFirst({ where: { organizationId, email } }) : null;
      if (duplicateUser) warnings.push("同邮箱用户可能重复");
    }
  } else if (type === "classes") {
    requireField("name", "班级名称");
    requireField("courseName", "关联课程");
    requireField("teacherName", "主讲老师");
    if (data.capacity === undefined) errors.push("容量必须为数字");
    if (data.courseName && !(await prisma.course.findFirst({ where: { organizationId, name: String(data.courseName) } }))) errors.push("关联课程未匹配");
    if (data.teacherName && !(await prisma.teacher.findFirst({ where: { organizationId, name: String(data.teacherName) } }))) errors.push("主讲老师未匹配");
  } else if (type === "credit-balances") {
    requireField("studentName", "学员姓名");
    requireField("courseName", "课程名称");
    if (data.totalPurchasedHours === undefined) errors.push("已购买课时必须为数字");
    if (data.totalConsumedHours === undefined) errors.push("已消耗课时必须为数字");
    if (data.remainingHours === undefined) errors.push("剩余课时必须为数字或可自动计算");
    if (data.studentName && !(await findStudent(organizationId, String(data.studentName), data.phone ? String(data.phone) : undefined))) errors.push("学员未匹配");
    if (data.courseName && !(await prisma.course.findFirst({ where: { organizationId, name: String(data.courseName) } }))) errors.push("课程未匹配");
  } else if (type === "schedules") {
    requireField("courseName", "课程名称");
    requireField("teacherName", "老师姓名");
    requireField("date", "上课日期");
    requireField("startTime", "开始时间");
    requireField("endTime", "结束时间");
    if (!data.studentName && !data.className) errors.push("学员姓名和班级名称至少填写一个");
    if (data.startTime && !isTime(String(data.startTime))) errors.push("开始时间必须为 HH:mm");
    if (data.endTime && !isTime(String(data.endTime))) errors.push("结束时间必须为 HH:mm");
    if (data.courseName && !(await prisma.course.findFirst({ where: { organizationId, name: String(data.courseName) } }))) errors.push("课程未匹配");
    if (data.teacherName && !(await prisma.teacher.findFirst({ where: { organizationId, name: String(data.teacherName) } }))) errors.push("老师未匹配");
  } else if (type === "lesson-records") {
    requireField("courseName", "课程名称");
    requireField("teacherName", "老师姓名");
    requireField("date", "上课日期");
    if (data.startTime && !isTime(String(data.startTime))) errors.push("开始时间必须为 HH:mm");
    if (data.endTime && !isTime(String(data.endTime))) errors.push("结束时间必须为 HH:mm");
    if (data.durationHours === undefined) errors.push("本节课时必须为数字");
    if (data.courseName && !(await prisma.course.findFirst({ where: { organizationId, name: String(data.courseName) } }))) errors.push("课程未匹配");
    if (data.teacherName && !(await prisma.teacher.findFirst({ where: { organizationId, name: String(data.teacherName) } }))) errors.push("老师未匹配");
  }
  return { errors, warnings };
}

async function findStudent(organizationId: string, name?: string, phone?: string) {
  if (phone) {
    const byPhone = await prisma.student.findFirst({ where: { organizationId, phone, deletedAt: null } });
    if (byPhone) return byPhone;
  }
  if (name) return prisma.student.findFirst({ where: { organizationId, name, deletedAt: null } });
  return null;
}

async function previewRows(type: ImportType, rows: RowData[], organizationId: string) {
  const preview: PreviewRow[] = [];
  for (const [index, raw] of rows.entries()) {
    const normalizedData = normalize(type, raw);
    const { errors, warnings } = await validateNormalized(type, normalizedData, organizationId);
    preview.push({
      rowNumber: index + 2,
      status: errors.length > 0 ? "invalid" : "valid",
      isValid: errors.length === 0,
      errors,
      warnings,
      rawData: raw,
      normalizedData,
      data: normalizedData,
    });
  }
  return preview;
}

async function advisorIdByName(organizationId: string, name?: string) {
  if (!name) return undefined;
  const user = await prisma.user.findFirst({ where: { organizationId, displayName: name } });
  return user?.id;
}

async function commitRows(type: ImportType, organizationId: string, userId: string | undefined, rows: PreviewRow[]) {
  const createdIds: Array<{ type: string; id: string }> = [];
  for (const row of rows.filter((item) => item.isValid || item.status === "valid")) {
    const data = row.normalizedData as Record<string, any>;
    if (type === "students") {
      const student = await prisma.student.create({
        data: {
          organizationId,
          name: data.name,
          phone: data.phone || `import-${Date.now()}-${row.rowNumber}`,
          grade: data.grade,
          school: data.school,
          targetCountry: data.targetCountry,
          targetDirection: data.targetDirection,
          parentPhone: data.parentPhone,
          tags: data.tags ?? [],
          riskStatus: String(data.riskStatus ?? "normal").toUpperCase() as any,
          notes: [data.parentName ? `家长姓名：${data.parentName}` : "", data.notes].filter(Boolean).join("\\n") || undefined,
          advisorId: await advisorIdByName(organizationId, data.advisorName),
        },
      });
      createdIds.push({ type: "student", id: student.id });
    } else if (type === "courses") {
      const teacher = data.teacherName ? await prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }) : null;
      const course = await prisma.course.create({
        data: {
          organizationId,
          name: data.name,
          category: toCourseCategory(data.category),
          level: data.level,
          totalLessons: Number(data.totalLessons),
          price: Number(data.price ?? 0),
          teachingMethod: data.teachingMethod,
          targetGrades: data.targetGrades ?? [],
          responsibleTeacherId: teacher?.id,
          description: data.description,
          syllabus: data.syllabus,
          status: String(data.status ?? "active").toUpperCase() as CourseStatus,
        },
      });
      createdIds.push({ type: "course", id: course.id });
    } else if (type === "teachers") {
      const teacher = await prisma.teacher.create({
        data: {
          organizationId,
          name: data.name,
          subjects: data.subjects?.length ? data.subjects : [],
          type: toTeacherType(data.type),
          availableTime: data.availableTime ?? [],
          status: data.status ?? "active",
        },
      });
      createdIds.push({ type: "teacher", id: teacher.id });
    } else if (type === "classes") {
      const [course, teacher] = await Promise.all([
        prisma.course.findFirst({ where: { organizationId, name: data.courseName } }),
        prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }),
      ]);
      if (!course || !teacher) continue;
      const classRecord = await prisma.class.create({
        data: {
          organizationId,
          name: data.name,
          courseId: course.id,
          teacherId: teacher.id,
          scheduleDesc: data.scheduleText,
          classroom: data.classroom,
          capacity: Number(data.capacity),
          status: data.status ?? "active",
        },
      });
      createdIds.push({ type: "class", id: classRecord.id });
    } else if (type === "credit-balances") {
      const [student, course] = await Promise.all([
        findStudent(organizationId, data.studentName, data.phone),
        prisma.course.findFirst({ where: { organizationId, name: data.courseName } }),
      ]);
      if (!student || !course) continue;
      const existingAccount = await prisma.creditAccount.findUnique({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      });
      const account = await prisma.creditAccount.upsert({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
        update: {
          balance: Number(data.remainingHours),
          totalPurchased: Number(data.totalPurchasedHours),
          totalConsumed: Number(data.totalConsumedHours),
          totalGifted: Number(data.giftedHours ?? 0),
          frozenHours: Number(data.frozenHours ?? 0),
          lowBalance: Number(data.remainingHours) <= 5,
          version: { increment: 1 },
        },
        create: {
          organizationId,
          studentId: student.id,
          courseId: course.id,
          balance: Number(data.remainingHours),
          totalPurchased: Number(data.totalPurchasedHours),
          totalConsumed: Number(data.totalConsumedHours),
          totalGifted: Number(data.giftedHours ?? 0),
          frozenHours: Number(data.frozenHours ?? 0),
          lowBalance: Number(data.remainingHours) <= 5,
          status: "active",
        },
      });
      const transaction = await prisma.creditTransaction.create({
        data: {
          organizationId,
          accountId: account.id,
          studentId: student.id,
          courseId: course.id,
          adjustType: CreditAdjustType.MANUAL,
          creditsDelta: Number(data.remainingHours),
          balanceBefore: 0,
          balanceAfter: Number(data.remainingHours),
          status: CreditTransactionStatus.PAID,
          courseName: course.name,
          notes: data.notes ?? "Excel 导入期初课时余额",
          createdBy: userId,
        },
      });
      if (existingAccount) {
        createdIds.push({
          type: "credit_account_restore",
          id: account.id,
          snapshot: {
            balance: existingAccount.balance.toString(),
            totalPurchased: existingAccount.totalPurchased.toString(),
            totalConsumed: existingAccount.totalConsumed.toString(),
            totalGifted: existingAccount.totalGifted.toString(),
            frozenHours: existingAccount.frozenHours.toString(),
            lowBalance: existingAccount.lowBalance,
            status: existingAccount.status,
          },
        } as any);
      } else {
        createdIds.push({ type: "credit_account", id: account.id });
      }
      createdIds.push({ type: "credit_transaction", id: transaction.id });
    } else if (type === "schedules") {
      const [course, teacher, student, classRecord] = await Promise.all([
        prisma.course.findFirst({ where: { organizationId, name: data.courseName } }),
        prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }),
        data.studentName ? findStudent(organizationId, data.studentName) : null,
        data.className ? prisma.class.findFirst({ where: { organizationId, name: data.className } }) : null,
      ]);
      if (!course || !teacher) continue;
      const schedule = await prisma.schedule.create({
        data: {
          organizationId,
          courseId: course.id,
          teacherId: teacher.id,
          studentId: student?.id,
          classId: classRecord?.id,
          classroom: data.classroom,
          title: course.name,
          lessonDate: dateOnly(data.date),
          startTime: timeOnly(data.startTime),
          endTime: timeOnly(data.endTime),
          durationHours: durationHours(data.startTime, data.endTime),
          status: toStatusEnum(data.status, ScheduleStatus, "SCHEDULED") as ScheduleStatus,
          notes: data.notes,
          createdBy: userId,
        },
      });
      createdIds.push({ type: "schedule", id: schedule.id });
    } else if (type === "lesson-records") {
      const [course, teacher, student, classRecord] = await Promise.all([
        prisma.course.findFirst({ where: { organizationId, name: data.courseName } }),
        prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }),
        data.studentName ? findStudent(organizationId, data.studentName) : null,
        data.className ? prisma.class.findFirst({ where: { organizationId, name: data.className } }) : null,
      ]);
      if (!course || !teacher) continue;
      const record = await prisma.lessonRecord.create({
        data: {
          organizationId,
          courseId: course.id,
          teacherId: teacher.id,
          studentId: student?.id,
          classId: classRecord?.id,
          lessonDate: dateOnly(data.date),
          startTime: data.startTime ? timeOnly(data.startTime) : undefined,
          endTime: data.endTime ? timeOnly(data.endTime) : undefined,
          durationHours: Number(data.durationHours),
          topic: data.topic,
          performance: data.performance ?? data.feedback,
          homework: data.homework,
          internalNotes: data.notes,
          attendance: LessonAttendance.PRESENT,
          status: toStatusEnum(data.status, LessonStatus, "COMPLETED") as LessonStatus,
          feedbackStatus: LessonFeedbackStatus.SUBMITTED,
          deductionStatus: data.deducted ? LessonDeductionStatus.DEDUCTED : LessonDeductionStatus.PENDING,
        },
      });
      createdIds.push({ type: "lesson_record", id: record.id });
    }
  }
  return createdIds;
}

function batchPayload(log: {
  id: string;
  importType: string;
  fileName: string | null;
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: string;
  result: Prisma.JsonValue | null;
  createdBy: string | null;
  createdAt: Date;
  importedAt: Date | null;
  rolledBackAt: Date | null;
}) {
  const rows = (log.result as { rows?: PreviewRow[] } | null)?.rows ?? [];
  const warningRows = rows.filter((row) => row.warnings?.length).length;
  return {
    id: log.id,
    importBatchId: log.id,
    type: log.importType,
    typeLabel: importTypeLabels[log.importType as ImportType] ?? log.importType,
    fileName: log.fileName ?? "rows.json",
    totalRows: log.totalRows,
    validRows: log.successRows,
    invalidRows: log.failedRows,
    warningRows,
    status: log.status,
    createdBy: log.createdBy,
    createdAt: log.createdAt.toISOString(),
    confirmedAt: log.importedAt?.toISOString(),
    rollbackAt: log.rolledBackAt?.toISOString(),
  };
}

async function createWorkbook(headers: string[], rows: RowData[], sheetName = "data") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((key) => row[key] ?? "")));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function sendWorkbook(res: Parameters<typeof ok>[0], fileName: string, buffer: Buffer) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"${encodeURIComponent(fileName)}\"`);
  return res.send(buffer);
}

async function handleTemplate(req: any, res: any) {
  const type = assertImportType(req.params.type);
  assertImportPermission(req.user, type);
  const headers = importTemplates[type];
  const sample = Object.fromEntries(headers.map((header) => [header, ""]));
  const buffer = await createWorkbook(headers, [sample], "template");
  await logOperation(req, { action: "download_import_template", resourceType: "import_template", detail: { type } });
  return sendWorkbook(res, `${type}-template.xlsx`, buffer);
}

async function handlePreview(req: any, res: any) {
  const type = assertImportType(req.body.type ?? req.params.type);
  assertImportPermission(req.user, type);
  const rows = await parseRows(req);
  if (!rows.length) throw badRequest("未读取到可导入的数据行");
  const preview = await previewRows(type, rows, req.user.organizationId);
  const validRows = preview.filter((row) => row.isValid).length;
  const invalidRows = preview.length - validRows;
  const log = await prisma.importLog.create({
    data: {
      organizationId: req.user.organizationId,
      importType: type,
      fileName: req.file?.originalname,
      totalRows: preview.length,
      successRows: validRows,
      failedRows: invalidRows,
      status: "previewed",
      result: jsonInput({ rows: preview }),
      createdBy: req.user.id,
    },
  });
  await logOperation(req, { action: "preview_import", resourceType: "import_log", resourceId: log.id, detail: { type, totalRows: preview.length, validRows, invalidRows } });
  return created(res, {
    importBatchId: log.id,
    batchId: log.id,
    totalRows: preview.length,
    validRows,
    invalidRows,
    warningRows: preview.filter((row) => row.warnings.length).length,
    errors: preview.flatMap((row) => row.errors.map((message) => ({ rowNumber: row.rowNumber, message }))),
    previewRows: preview.slice(0, 20),
    rows: preview,
  });
}

async function handleConfirm(req: any, res: any) {
  const log = await prisma.importLog.findFirst({ where: { id: req.params.batchId ?? req.params.id, organizationId: req.user.organizationId } });
  if (!log) throw notFound("Import batch");
  const type = assertImportType(log.importType);
  assertImportPermission(req.user, type);
  if (log.status !== "previewed") throw badRequest("导入批次不是可确认状态");
  const rows = (log.result as { rows?: PreviewRow[] } | null)?.rows ?? [];
  const createdIds = await commitRows(type, req.user.organizationId, req.user.id, rows);
  const updated = await prisma.importLog.update({
    where: { id: log.id },
    data: { status: "imported", importedAt: new Date(), result: jsonInput({ rows, createdIds }) },
  });
  await logOperation(req, { action: "confirm_import", resourceType: "import_log", resourceId: updated.id, detail: { type, createdCount: createdIds.length } });
  return ok(res, { importBatchId: updated.id, batchId: updated.id, createdIds, createdCount: createdIds.length, status: updated.status });
}

async function handleBatches(req: any, res: any) {
  const types = allowedImportTypes(req.user);
  if (!types.length) throw new AppError(403, "FORBIDDEN", "当前账号无权查看导入批次");
  const logs = await prisma.importLog.findMany({
    where: { organizationId: req.user.organizationId, importType: { in: types } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(res, logs.map(batchPayload));
}

async function handleBatchDetail(req: any, res: any) {
  const log = await prisma.importLog.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!log) throw notFound("Import batch");
  assertImportBatchAccess(req.user, log.importType);
  return ok(res, { ...batchPayload(log), previewRows: (log.result as { rows?: PreviewRow[] } | null)?.rows ?? [], createdIds: (log.result as { createdIds?: unknown[] } | null)?.createdIds ?? [] });
}

async function handleRollback(req: any, res: any) {
  const log = await prisma.importLog.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!log) throw notFound("Import batch");
  const type = assertImportType(log.importType);
  assertImportPermission(req.user, type);
  if (req.user.role !== "admin" && req.user.role !== "academic_manager") throw new AppError(403, "FORBIDDEN", "当前账号无权回滚导入批次");
  if (log.status !== "imported") throw badRequest("只有已导入批次可以回滚");
  const createdIds = (log.result as { createdIds?: Array<{ type: string; id: string }> } | null)?.createdIds ?? [];
  for (const item of [...createdIds].reverse()) {
    if (item.type === "credit_transaction") await prisma.creditTransaction.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "credit_account") await prisma.creditAccount.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "credit_account_restore" && (item as any).snapshot) {
      const snapshot = (item as any).snapshot;
      await prisma.creditAccount.updateMany({
        where: { id: item.id, organizationId: req.user.organizationId },
        data: {
          balance: Number(snapshot.balance),
          totalPurchased: Number(snapshot.totalPurchased),
          totalConsumed: Number(snapshot.totalConsumed),
          totalGifted: Number(snapshot.totalGifted),
          frozenHours: Number(snapshot.frozenHours),
          lowBalance: Boolean(snapshot.lowBalance),
          status: String(snapshot.status ?? "active"),
          version: { increment: 1 },
        },
      });
    }
    if (item.type === "lesson_record") await prisma.lessonRecord.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "schedule") await prisma.schedule.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "class") await prisma.class.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "teacher") await prisma.teacher.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "course") await prisma.course.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    if (item.type === "student") await prisma.student.updateMany({ where: { id: item.id, organizationId: req.user.organizationId }, data: { deletedAt: new Date() } });
  }
  const updated = await prisma.importLog.update({ where: { id: log.id }, data: { status: "rolled_back", rolledBackAt: new Date() } });
  await logOperation(req, { action: "rollback_import", resourceType: "import_log", resourceId: updated.id, detail: { type, rollbackCount: createdIds.length } });
  return ok(res, { importBatchId: updated.id, batchId: updated.id, rollbackCount: createdIds.length, status: updated.status });
}

function dateRangeWhere(req: any) {
  const startDate = normalizeDateValue(req.query.startDate ? String(req.query.startDate) : undefined);
  const endDate = normalizeDateValue(req.query.endDate ? String(req.query.endDate) : undefined);
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: dateOnly(startDate) } : {}),
    ...(endDate ? { lte: dateOnly(endDate) } : {}),
  };
}

async function exportRows(type: ExportType, req: any): Promise<RowData[]> {
  const organizationId = req.user.organizationId;
  const advisorStudentScope = req.user.role === "advisor" ? { student: { advisorId: req.user.id } } : {};
  if (type === "students") {
    const rows = await prisma.student.findMany({ where: { organizationId, deletedAt: null, ...(req.user.role === "advisor" ? { advisorId: req.user.id } : {}) } });
    return rows.map((row) => ({ 学员姓名: row.name, 手机号: row.phone, 年级: row.grade, 当前学校: row.school ?? "", 家长电话: row.parentPhone ?? "", 目标国家: row.targetCountry ?? "", 目标方向: row.targetDirection ?? "", 状态: row.status.toLowerCase() }));
  }
  if (type === "courses") {
    const rows = await prisma.course.findMany({ where: { organizationId } });
    return rows.map((row) => ({ 课程名称: row.name, 课程类别: row.category.toLowerCase(), 总课时: row.totalLessons, 标准价格: row.price.toString(), 状态: row.status.toLowerCase() }));
  }
  if (type === "teachers") {
    const rows = await prisma.teacher.findMany({ where: { organizationId } });
    return rows.map((row) => ({ 老师姓名: row.name, 老师类型: row.type.toLowerCase(), 擅长科目: Array.isArray(row.subjects) ? row.subjects.join("、") : "", 状态: row.status }));
  }
  if (type === "classes") {
    const rows = await prisma.class.findMany({ where: { organizationId }, include: { course: true, teacher: true } });
    return rows.map((row) => ({ 班级名称: row.name, 关联课程: row.course.name, 主讲老师: row.teacher.name, 上课时间: row.scheduleDesc ?? "", 教室: row.classroom ?? "", 容量: row.capacity, 状态: row.status }));
  }
  if (type === "credit-accounts") {
    const rows = await prisma.creditAccount.findMany({ where: { organizationId, ...advisorStudentScope }, include: { student: true, course: true } });
    return rows.map((row) => ({ 学员姓名: row.student.name, 课程名称: row.course?.name ?? "", 已购买课时: row.totalPurchased.toString(), 已消耗课时: row.totalConsumed.toString(), 剩余课时: row.balance.toString(), 赠送课时: row.totalGifted.toString(), 冻结课时: row.frozenHours.toString(), 状态: row.status }));
  }
  if (type === "credit-transactions") {
    const rows = await prisma.creditTransaction.findMany({ where: { organizationId, ...advisorStudentScope }, include: { student: true, course: true }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ 学员姓名: row.student.name, 课程名称: row.course?.name ?? row.courseName ?? "", 交易类型: row.adjustType.toLowerCase() === "manual" && row.notes?.includes("期初") ? "opening_balance" : row.adjustType.toLowerCase(), 课时变化: row.creditsDelta.toString(), 变动前: row.balanceBefore.toString(), 变动后: row.balanceAfter.toString(), 备注: row.notes ?? "", 创建时间: row.createdAt.toISOString() }));
  }
  if (type === "schedules") {
    const rows = await prisma.schedule.findMany({ where: { organizationId, lessonDate: dateRangeWhere(req), ...(req.user.role === "teacher" ? { teacher: { userId: req.user.id } } : {}) }, include: { student: true, class: true, course: true, teacher: true } });
    return rows.map((row) => ({ 课程名称: row.course.name, 学员姓名: row.student?.name ?? "", 班级名称: row.class?.name ?? "", 老师姓名: row.teacher.name, 上课日期: row.lessonDate.toISOString().slice(0, 10), 教室: row.classroom ?? "", 状态: row.status.toLowerCase() }));
  }
  if (type === "lesson-records") {
    const rows = await prisma.lessonRecord.findMany({ where: { organizationId, lessonDate: dateRangeWhere(req), ...(req.user.role === "teacher" ? { teacher: { userId: req.user.id } } : {}), ...advisorStudentScope }, include: { student: true, class: true, course: true, teacher: true } });
    return rows.map((row) => ({ 课程名称: row.course?.name ?? "", 学员姓名: row.student?.name ?? "", 班级名称: row.class?.name ?? "", 老师姓名: row.teacher.name, 上课日期: row.lessonDate.toISOString().slice(0, 10), 本节课时: row.durationHours.toString(), 状态: row.status.toLowerCase(), 反馈状态: row.feedbackStatus.toLowerCase() }));
  }
  if (type === "leave-makeup") {
    const rows = await prisma.leaveMakeupRequest.findMany({ where: { organizationId, ...advisorStudentScope }, include: { student: true, class: true, course: true, teacher: true } });
    return rows.map((row) => ({ 学员姓名: row.student?.name ?? "", 班级名称: row.class?.name ?? "", 课程: row.course.name, 老师: row.teacher.name, 申请类型: row.requestType.toLowerCase(), 状态: row.status.toLowerCase(), 原日期: row.originalDate.toISOString().slice(0, 10) }));
  }
  const rows = await prisma.parentReport.findMany({ where: { organizationId, ...(req.user.role === "advisor" ? { student: { advisorId: req.user.id } } : {}) }, include: { course: true } });
  return rows.map((row) => ({ 学员姓名: row.studentName, 课程: row.course?.name ?? "", 报告类型: row.reportType.toLowerCase(), 报告周期: row.periodLabel, 状态: row.status.toLowerCase(), 发送时间: row.sentAt?.toISOString() ?? "", 摘要: row.summary ?? "" }));
}

async function handleExport(req: any, res: any) {
  const type = assertExportType(req.params.type);
  assertExportPermission(req.user, type);
  const rows = await exportRows(type, req);
  const headers = Object.keys(rows[0] ?? { 数据: "" });
  const buffer = await createWorkbook(headers, rows.length ? rows : [{ 数据: "暂无数据" }], type);
  await logOperation(req, { action: "export_data", resourceType: "export", detail: { type, rowCount: rows.length } });
  return sendWorkbook(res, `${type}.xlsx`, buffer);
}

importsRouter.get("/templates/:type", asyncHandler(handleTemplate));
importsRouter.post("/preview", upload.single("file"), validate({ body: importPreviewSchema }), asyncHandler(handlePreview));
importsRouter.post("/confirm/:batchId", asyncHandler(handleConfirm));
importsRouter.get("/batches", asyncHandler(handleBatches));
importsRouter.get("/batches/:id", validate({ params: idParamSchema }), asyncHandler(handleBatchDetail));
importsRouter.post("/batches/:id/rollback", validate({ params: idParamSchema }), asyncHandler(handleRollback));

// Backward-compatible Sprint 3 paths.
importsRouter.post("/:type/preview", upload.single("file"), validate({ params: importTypeParamSchema, body: importPreviewSchema }), asyncHandler(handlePreview));
importsRouter.post("/:id/commit", validate({ params: idParamSchema }), asyncHandler(handleConfirm));
importsRouter.post("/:id/rollback", validate({ params: idParamSchema }), asyncHandler(handleRollback));
importsRouter.get("/export/:type", asyncHandler(handleExport));

exportsRouter.get("/:type", asyncHandler(handleExport));
