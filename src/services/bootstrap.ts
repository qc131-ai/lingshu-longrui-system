/**
 * 应用启动时通过各 service 加载初始状态
 */
import {
  students,
  courses,
  classes,
  teachers,
  lessonRecords,
  leaveRecords,
  assessments,
  competitions,
  creditTransactions,
} from "../data";
import { studentService } from "./studentService";
import { courseService } from "./courseService";
import { teacherService } from "./teacherService";
import { lessonService } from "./lessonService";
import { competitionService } from "./competitionService";
import { creditService } from "./creditService";

/** Mock 阶段同步初始值，避免首屏闪烁 */
export function getInitialAppStateSync() {
  return {
    students: [...students],
    courses: [...courses],
    classes: [...classes],
    teachers: [...teachers],
    lessonRecords: [...lessonRecords],
    leaveRecords: [...leaveRecords],
    assessments: [...assessments],
    competitions: [...competitions],
    orders: [...creditTransactions],
  };
}

/** 接入真实 API 后由 AppProvider 调用 */
export async function loadAppState() {
  const [
    studentsList,
    coursesList,
    classesList,
    teachersList,
    lessonRecordsList,
    leaveRecordsList,
    assessmentsList,
    competitionsList,
    ordersList,
  ] = await Promise.all([
    studentService.list(),
    courseService.list(),
    courseService.listClasses(),
    teacherService.list(),
    lessonService.listRecords(),
    lessonService.listLeaves(),
    lessonService.listAssessments(),
    competitionService.list(),
    creditService.listTransactions(),
  ]);

  return {
    students: studentsList,
    courses: coursesList,
    classes: classesList,
    teachers: teachersList,
    lessonRecords: lessonRecordsList,
    leaveRecords: leaveRecordsList,
    assessments: assessmentsList,
    competitions: competitionsList,
    orders: ordersList,
  };
}
