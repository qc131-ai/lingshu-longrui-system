import type { Schedule } from "../types";
import { scheduleEvents as seedEvents } from "../data/schedule";
import { scheduleRoomOptions, scheduleTeacherOptions } from "../data/pageStats";
import { generateId } from "./config";
import { apiClient, createApiCallState } from "./apiClient";

export type CreateScheduleInput = {
  studentId?: string;
  classId?: string;
  courseId?: string;
  courseName: string;
  teacherId?: string;
  teacher: string;
  roomId: string;
  classroom?: string;
  date: string;
  startTime: string;
  endTime?: string;
  duration: number;
  consumedHours?: number;
  lessonType?: "class" | "exam" | "meeting";
  status?: "scheduled" | "completed" | "cancelled";
};

export type ListScheduleFilters = {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  weekStart?: string | Date | null;
  weekEnd?: string | Date | null;
  teacherId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  status?: "scheduled" | "completed" | "cancelled" | "" | null;
};

export const scheduleApiState = {
  list: createApiCallState<Schedule[]>(),
  create: createApiCallState<{ event: Schedule; hasConflict: boolean }>(),
  update: createApiCallState<Schedule>(),
};

function resolveRoomLabel(roomId: string): string {
  return scheduleRoomOptions.find((r) => r.id === roomId)?.label ?? roomId;
}

function buildScheduleEvent(input: CreateScheduleInput): Schedule {
  const selectedDateObj = new Date(input.date);
  let colIndex = selectedDateObj.getDay() - 1;
  if (colIndex < 0) colIndex = 6;

  const startHour = parseInt(input.startTime.split(":")[0], 10);
  const topIndex = startHour - 8;

  return {
    id: generateId("EV"),
    colIndex,
    topIndex,
    durationSlots: input.duration,
    title: input.courseName,
    teacher: input.teacher,
    room: resolveRoomLabel(input.roomId),
    timeString: `${input.startTime} - ${startHour + input.duration}:00`,
    type: "class",
  };
}

function toTimeText(startTime: string, duration: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  return `${String(hours + duration).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toCreateSchedulePayload(input: CreateScheduleInput) {
  return {
    studentId: input.studentId,
    classId: input.classId,
    courseId: input.courseId,
    courseName: input.courseName,
    teacherId: input.teacherId,
    teacher: input.teacher,
    roomId: input.roomId,
    classroom: input.classroom ?? resolveRoomLabel(input.roomId),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime ?? toTimeText(input.startTime, input.duration),
    duration: input.duration,
    consumedHours: input.consumedHours ?? input.duration,
    lessonType: input.lessonType ?? "class",
    status: input.status ?? "scheduled",
  };
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function toDateQueryValue(value: string | Date | null | undefined) {
  if (!value) return undefined;
  if (value instanceof Date) return isValidDate(value) ? value.toISOString().slice(0, 10) : undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

function appendQueryParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") return;
  if (value === "undefined" || value === "null" || value === "Invalid Date") return;
  params.set(key, value);
}

function buildScheduleQuery(filters: ListScheduleFilters = {}) {
  const params = new URLSearchParams();
  appendQueryParam(params, "startDate", toDateQueryValue(filters.startDate ?? filters.weekStart));
  appendQueryParam(params, "endDate", toDateQueryValue(filters.endDate ?? filters.weekEnd));
  appendQueryParam(params, "teacherId", filters.teacherId ?? undefined);
  appendQueryParam(params, "studentId", filters.studentId ?? undefined);
  appendQueryParam(params, "classId", filters.classId ?? undefined);
  appendQueryParam(params, "courseId", filters.courseId ?? undefined);
  appendQueryParam(params, "status", filters.status ?? undefined);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function detectConflict(newEvent: Schedule, existing: Schedule[]): boolean {
  return existing.some(
    (ev) =>
      ev.colIndex === newEvent.colIndex &&
      ((newEvent.topIndex >= ev.topIndex && newEvent.topIndex < ev.topIndex + ev.durationSlots) ||
        (ev.topIndex >= newEvent.topIndex && ev.topIndex < newEvent.topIndex + newEvent.durationSlots))
  );
}

export const scheduleService = {
  async listEvents(filters: ListScheduleFilters = {}): Promise<Schedule[]> {
    return apiClient.requestWithFallback<Schedule[]>(
      `/schedules${buildScheduleQuery(filters)}`,
      { method: "GET" },
      () => [...seedEvents],
      scheduleApiState.list,
      "排课列表查询失败"
    );
  },

  /** 新建排课 */
  async createSchedule(input: CreateScheduleInput, existingEvents: Schedule[] = []): Promise<{
    event: Schedule;
    hasConflict: boolean;
  }> {
    return apiClient.requestWithFallback<{ event: Schedule; hasConflict: boolean }>(
      "/schedules",
      { method: "POST", body: JSON.stringify(toCreateSchedulePayload(input)) },
      () => {
      const event = buildScheduleEvent(input);
      const hasConflict = detectConflict(event, existingEvents);
      return { event, hasConflict };
      },
      scheduleApiState.create,
      "排课创建失败"
    );
  },

  /** 取消排课 */
  async cancelSchedule(eventId: string, existingEvents: Schedule[]): Promise<Schedule[]> {
    await apiClient.requestWithFallback<Schedule>(
      `/schedules/${eventId}`,
      { method: "PUT", body: JSON.stringify({ status: "cancelled" }) },
      () => existingEvents.find((e) => e.id === eventId) ?? buildScheduleEvent({
        courseName: "已取消排课",
        teacher: "",
        roomId: "room-1",
        date: new Date().toISOString().slice(0, 10),
        startTime: "10:00",
        duration: 1,
      }),
      scheduleApiState.update,
      "排课更新失败"
    );
    if (scheduleApiState.update.status === "error") {
      return existingEvents.filter((e) => e.id !== eventId);
    }
    return this.listEvents();
  },

  async getTeacherOptions() {
    return [...scheduleTeacherOptions];
  },

  async getInitialEvents() {
    return this.listEvents();
  },

  getTeacherOptionsSync() {
    return [...scheduleTeacherOptions];
  },

  getInitialEventsSync() {
    return [...seedEvents];
  },
};
