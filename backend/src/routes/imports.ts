import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import {
  CourseCategory,
  CourseStatus,
  CreditAdjustType,
  CreditTransactionStatus,
  LessonAttendance,
  LessonFeedbackStatus,
  LessonStatus,
  Prisma,
  ScheduleStatus,
  TeacherType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, importPreviewSchema, importTypeParamSchema } from "../validators/schemas.js";
import { requireRoles } from "../middleware/auth.js";
import { logOperation } from "../lib/operationLog.js";

export const importsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

type ImportType = "students" | "courses" | "teachers" | "credits" | "schedules" | "lesson-records" | "orders";
type ImportRow = Record<string, unknown>;
type PreviewRow = { rowNumber: number; status: "valid" | "invalid"; errors: string[]; data: ImportRow };

function text(row: ImportRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

function numberValue(row: ImportRow, ...keys: string[]) {
  const value = text(row, ...keys);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolValue(row: ImportRow, ...keys: string[]) {
  const value = text(row, ...keys);
  if (!value) return undefined;
  return ["是", "true", "1", "yes"].includes(value.toLowerCase());
}

function dateText(row: ImportRow, ...keys: string[]) {
  const value = text(row, ...keys);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
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
  return (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
}

function splitList(value?: string) {
  return value ? value.split(/[;；,，]/).map((item) => item.trim()).filter(Boolean) : [];
}

async function parseRows(req: Parameters<typeof importsRouter.post>[1] extends never ? never : any): Promise<ImportRow[]> {
  if (req.file?.buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim();
    });
    const rows: ImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: ImportRow = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber];
        if (key) item[key] = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text || cell.value || "";
      });
      rows.push(item);
    });
    return rows;
  }
  return Array.isArray(req.body.rows) ? req.body.rows : [];
}

function normalize(type: ImportType, row: ImportRow) {
  if (type === "students") {
    return {
      name: text(row, "学员姓名", "姓名", "name"),
      phone: text(row, "手机号", "phone"),
      grade: text(row, "年级", "grade") ?? "10年级",
      school: text(row, "学校", "school"),
      parentPhone: text(row, "家长电话", "parentPhone"),
      enrollmentDate: dateText(row, "入学日期", "enrollmentDate"),
      tags: splitList(text(row, "标签", "tags")),
      targetCountry: text(row, "目标国家", "targetCountry"),
      targetDirection: text(row, "目标方向", "targetDirection"),
      notes: text(row, "备注", "notes"),
      advisorEmail: text(row, "负责顾问邮箱", "advisorEmail"),
    };
  }
  if (type === "courses") {
    return {
      name: text(row, "课程名称", "name"),
      category: text(row, "课程分类", "分类", "category") ?? "math",
      level: text(row, "级别", "level") ?? "基础",
      totalLessons: numberValue(row, "标准总课时", "totalLessons") ?? 1,
      price: numberValue(row, "标准价格", "price") ?? 0,
      teachingMethod: text(row, "授课方式", "teachingMethod"),
      targetGrades: splitList(text(row, "适用年级", "targetGrades")),
      description: text(row, "课程描述", "description"),
      status: text(row, "状态", "status") ?? "active",
    };
  }
  if (type === "teachers") {
    return {
      name: text(row, "老师姓名", "姓名", "name"),
      email: text(row, "登录邮箱", "email"),
      subjects: splitList(text(row, "授课科目", "subjects")),
      type: text(row, "老师类型", "type") ?? "full-time",
      availableTime: splitList(text(row, "可用时间", "availableTime")),
      status: text(row, "状态", "status") ?? "active",
    };
  }
  if (type === "credits") {
    return {
      phone: text(row, "学员手机号", "手机号", "phone"),
      courseName: text(row, "课程名称", "courseName"),
      balance: numberValue(row, "当前余额", "balance"),
      totalPurchased: numberValue(row, "累计购买", "totalPurchased"),
      totalConsumed: numberValue(row, "累计消耗", "totalConsumed"),
      expireDate: dateText(row, "到期日期", "expireDate"),
      notes: text(row, "备注", "notes"),
    };
  }
  if (type === "schedules") {
    return {
      courseName: text(row, "课程名称", "courseName"),
      teacherName: text(row, "老师姓名", "teacherName"),
      className: text(row, "班级名称", "className"),
      room: text(row, "教室", "room") ?? "待确认教室",
      date: dateText(row, "上课日期", "date"),
      startTime: text(row, "开始时间", "startTime"),
      endTime: text(row, "结束时间", "endTime"),
      status: text(row, "状态", "status") ?? "scheduled",
    };
  }
  if (type === "lesson-records") {
    return {
      phone: text(row, "学员手机号", "手机号", "phone"),
      className: text(row, "班级名称", "className"),
      teacherName: text(row, "老师姓名", "teacherName"),
      date: dateText(row, "上课日期", "date"),
      topic: text(row, "课程主题", "topic"),
      attendance: text(row, "出勤", "attendance") ?? "present",
      status: text(row, "上课状态", "status") ?? "completed",
      creditsConsumed: numberValue(row, "消耗课时", "creditsConsumed") ?? 0,
      performance: text(row, "课堂表现", "performance"),
      homework: text(row, "作业要求", "homework"),
      deducted: boolValue(row, "是否已消课", "deducted") ?? false,
    };
  }
  return {
    orderNo: text(row, "订单号", "orderNo"),
    phone: text(row, "学员手机号", "手机号", "phone"),
    courseName: text(row, "课程名称", "courseName"),
    credits: numberValue(row, "购买课时", "credits"),
    amount: numberValue(row, "实收金额", "amount") ?? 0,
    status: text(row, "付款状态", "status") ?? "paid",
    transactionDate: dateText(row, "下单日期", "transactionDate"),
    expireDate: dateText(row, "到期日期", "expireDate"),
    notes: text(row, "备注", "notes"),
  };
}

function validateRow(type: ImportType, data: ImportRow) {
  const errors: string[] = [];
  const requireField = (field: string, label: string) => {
    if (!data[field]) errors.push(`${label}不能为空`);
  };
  if (type === "students") {
    requireField("name", "学员姓名");
    requireField("phone", "手机号");
  } else if (type === "courses") {
    requireField("name", "课程名称");
    if (!["math", "physics", "chemistry", "english", "competition", "research"].includes(String(data.category))) {
      errors.push("课程分类不合法");
    }
  } else if (type === "teachers") {
    requireField("name", "老师姓名");
    if (!Array.isArray(data.subjects) || data.subjects.length === 0) errors.push("授课科目不能为空");
  } else if (type === "credits") {
    requireField("phone", "学员手机号");
    if (data.balance === undefined) errors.push("当前余额不能为空");
  } else if (type === "schedules") {
    requireField("courseName", "课程名称");
    requireField("teacherName", "老师姓名");
    requireField("date", "上课日期");
    requireField("startTime", "开始时间");
    requireField("endTime", "结束时间");
  } else if (type === "lesson-records") {
    requireField("phone", "学员手机号");
    requireField("className", "班级名称");
    requireField("teacherName", "老师姓名");
    requireField("date", "上课日期");
  } else if (type === "orders") {
    requireField("orderNo", "订单号");
    requireField("phone", "学员手机号");
    if (data.credits === undefined) errors.push("购买课时不能为空");
  }
  return errors;
}

async function commitRows(type: ImportType, organizationId: string, userId: string | undefined, rows: PreviewRow[]) {
  const createdIds: Array<{ type: string; id: string }> = [];
  for (const row of rows.filter((item) => item.status === "valid")) {
    const data = row.data as Record<string, any>;
    if (type === "students") {
      const advisor = data.advisorEmail ? await prisma.user.findFirst({ where: { email: data.advisorEmail, organizationId } }) : null;
      const student = await prisma.student.create({
        data: {
          organizationId,
          name: data.name,
          phone: data.phone,
          grade: data.grade,
          school: data.school,
          parentPhone: data.parentPhone,
          enrollmentDate: data.enrollmentDate ? new Date(`${data.enrollmentDate}T00:00:00.000Z`) : undefined,
          tags: data.tags ?? [],
          targetCountry: data.targetCountry,
          targetDirection: data.targetDirection,
          notes: data.notes,
          advisorId: advisor?.id,
          creditAccounts: { create: { organizationId, balance: 0, totalPurchased: 0 } },
        },
      });
      createdIds.push({ type: "student", id: student.id });
    } else if (type === "courses") {
      const course = await prisma.course.create({
        data: {
          organizationId,
          name: data.name,
          category: data.category.toUpperCase() as CourseCategory,
          level: data.level,
          totalLessons: data.totalLessons,
          price: data.price,
          teachingMethod: data.teachingMethod,
          targetGrades: data.targetGrades ?? [],
          description: data.description,
          status: String(data.status).toUpperCase() as CourseStatus,
        },
      });
      createdIds.push({ type: "course", id: course.id });
    } else if (type === "teachers") {
      const teacher = await prisma.teacher.create({
        data: {
          organizationId,
          name: data.name,
          subjects: data.subjects,
          type: String(data.type).replace("-", "_").toUpperCase() as TeacherType,
          availableTime: data.availableTime ?? [],
          status: data.status,
        },
      });
      createdIds.push({ type: "teacher", id: teacher.id });
    } else if (type === "credits" || type === "orders") {
      const student = await prisma.student.findFirst({ where: { phone: data.phone, organizationId }, include: { creditAccounts: true } });
      const studentAccount = student?.creditAccounts[0];
      if (!studentAccount) continue;
      const amount = type === "credits" ? Number(data.balance) : Number(data.credits);
      const account = await prisma.creditAccount.update({
        where: { id: studentAccount.id },
        data: {
          balance: type === "credits" ? Number(data.balance) : { increment: amount },
          totalPurchased: { increment: amount },
          totalConsumed: type === "credits" && data.totalConsumed !== undefined ? Number(data.totalConsumed) : undefined,
          version: { increment: 1 },
        },
      });
      const transaction = await prisma.creditTransaction.create({
        data: {
          organizationId,
          accountId: account.id,
          studentId: student.id,
          adjustType: CreditAdjustType.PURCHASE,
          creditsDelta: amount,
          balanceAfter: account.balance,
          amount: Number(data.amount ?? 0),
          status: String(data.status ?? "paid").toUpperCase() as CreditTransactionStatus,
          courseName: data.courseName ?? "历史导入",
          notes: data.notes ?? data.orderNo,
          transactionDate: data.transactionDate ? new Date(`${data.transactionDate}T00:00:00.000Z`) : new Date(),
          expireDate: data.expireDate ? new Date(`${data.expireDate}T00:00:00.000Z`) : undefined,
          createdBy: userId,
        },
      });
      createdIds.push({ type: "credit_transaction", id: transaction.id });
    } else if (type === "schedules") {
      const [course, teacher, classRecord] = await Promise.all([
        prisma.course.findFirst({ where: { organizationId, name: data.courseName } }),
        prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }),
        data.className ? prisma.class.findFirst({ where: { organizationId, name: data.className } }) : null,
      ]);
      if (!course || !teacher) continue;
      let room = await prisma.room.findFirst({ where: { organizationId, OR: [{ label: data.room }, { code: data.room }] } });
      room ??= await prisma.room.create({ data: { organizationId, code: `import-${Date.now()}`, label: data.room, capacity: 10 } });
      const schedule = await prisma.schedule.create({
        data: {
          organizationId,
          courseId: course.id,
          teacherId: teacher.id,
          classId: classRecord?.id,
          roomId: room.id,
          title: course.name,
          lessonDate: dateOnly(data.date),
          startTime: timeOnly(data.startTime),
          endTime: timeOnly(data.endTime),
          durationHours: durationHours(data.startTime, data.endTime),
          status: String(data.status).toUpperCase() as ScheduleStatus,
          createdBy: userId,
        },
      });
      createdIds.push({ type: "schedule", id: schedule.id });
    } else if (type === "lesson-records") {
      const [student, classRecord, teacher] = await Promise.all([
        prisma.student.findFirst({ where: { organizationId, phone: data.phone }, include: { creditAccounts: true } }),
        prisma.class.findFirst({ where: { organizationId, name: data.className } }),
        prisma.teacher.findFirst({ where: { organizationId, name: data.teacherName } }),
      ]);
      if (!student || !classRecord || !teacher) continue;
      const record = await prisma.lessonRecord.create({
        data: {
          organizationId,
          classId: classRecord.id,
          studentId: student.id,
          teacherId: teacher.id,
          lessonDate: dateOnly(data.date),
          topic: data.topic,
          attendance: String(data.attendance).toUpperCase() as LessonAttendance,
          status: String(data.status).toUpperCase() as LessonStatus,
          feedbackStatus: LessonFeedbackStatus.SUBMITTED,
          creditsConsumed: Number(data.creditsConsumed ?? 0),
          performance: data.performance,
          homework: data.homework,
        },
      });
      createdIds.push({ type: "lesson_record", id: record.id });
    }
  }
  return createdIds;
}

importsRouter.post(
  "/:type/preview",
  requireRoles("admin", "academic_manager", "finance"),
  upload.single("file"),
  validate({ params: importTypeParamSchema, body: importPreviewSchema }),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ImportType;
    const rows = await parseRows(req);
    if (!rows.length) throw badRequest("No import rows found");
    const previewRows: PreviewRow[] = rows.map((row, index) => {
      const data = normalize(type, row);
      const errors = validateRow(type, data);
      return { rowNumber: index + 2, status: errors.length ? "invalid" : "valid", errors, data };
    });
    const log = await prisma.importLog.create({
      data: {
        organizationId: req.user.organizationId,
        importType: type,
        fileName: req.file?.originalname,
        totalRows: previewRows.length,
        successRows: previewRows.filter((row) => row.status === "valid").length,
        failedRows: previewRows.filter((row) => row.status === "invalid").length,
        status: "previewed",
        result: { rows: previewRows } as Prisma.InputJsonValue,
        createdBy: req.user.id,
      },
    });
    return created(res, { batchId: log.id, summary: { totalRows: log.totalRows, successRows: log.successRows, failedRows: log.failedRows }, rows: previewRows });
  })
);

importsRouter.post(
  "/:id/commit",
  requireRoles("admin", "academic_manager", "finance"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const log = await prisma.importLog.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!log) throw notFound("Import batch");
    if (log.status !== "previewed") throw badRequest("Import batch is not previewed");
    const rows = (log.result as { rows?: PreviewRow[] } | null)?.rows ?? [];
    const createdIds = await commitRows(log.importType as ImportType, req.user.organizationId, req.user.id, rows);
    const updated = await prisma.importLog.update({
      where: { id: log.id },
      data: { status: "imported", importedAt: new Date(), result: { rows, createdIds } as Prisma.InputJsonValue },
    });
    await logOperation(req, {
      action: "commit_import",
      resourceType: "import_log",
      resourceId: updated.id,
      detail: { importType: updated.importType, createdCount: createdIds.length },
    });
    return ok(res, { batchId: updated.id, createdIds });
  })
);

importsRouter.post(
  "/:id/rollback",
  requireRoles("admin"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const log = await prisma.importLog.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!log) throw notFound("Import batch");
    const createdIds = (log.result as { createdIds?: Array<{ type: string; id: string }> } | null)?.createdIds ?? [];
    for (const item of [...createdIds].reverse()) {
      if (item.type === "student") await prisma.student.updateMany({ where: { id: item.id, organizationId: req.user.organizationId }, data: { deletedAt: new Date() } });
      if (item.type === "course") await prisma.course.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
      if (item.type === "teacher") await prisma.teacher.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
      if (item.type === "schedule") await prisma.schedule.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
      if (item.type === "lesson_record") await prisma.lessonRecord.deleteMany({ where: { id: item.id, organizationId: req.user.organizationId } });
    }
    const updated = await prisma.importLog.update({
      where: { id: log.id },
      data: { status: "rolled_back", rolledBackAt: new Date() },
    });
    await logOperation(req, {
      action: "rollback_import",
      resourceType: "import_log",
      resourceId: updated.id,
      detail: { importType: updated.importType, rollbackCount: createdIds.length },
    });
    return ok(res, { batchId: updated.id, rollbackCount: createdIds.length });
  })
);

importsRouter.get(
  "/export/:type",
  requireRoles("admin", "academic_manager", "finance"),
  validate({ params: importTypeParamSchema }),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ImportType;
    let rows: Record<string, unknown>[] = [];
    if (type === "students") rows = await prisma.student.findMany({ where: { organizationId: req.user.organizationId, deletedAt: null } });
    if (type === "courses") rows = await prisma.course.findMany({ where: { organizationId: req.user.organizationId } });
    if (type === "teachers") rows = await prisma.teacher.findMany({ where: { organizationId: req.user.organizationId } });
    if (type === "credits" || type === "orders") rows = await prisma.creditTransaction.findMany({ where: { organizationId: req.user.organizationId } });
    if (type === "schedules") rows = await prisma.schedule.findMany({ where: { organizationId: req.user.organizationId } });
    if (type === "lesson-records") rows = await prisma.lessonRecord.findMany({ where: { organizationId: req.user.organizationId } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("data");
    const headers = Object.keys(rows[0] ?? {});
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(headers.map((key) => row[key])));
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${type}.xlsx"`);
    return res.send(Buffer.from(buffer));
  })
);
