import type { Schedule, ScheduleStatus } from "../types/schedule";
import { scheduleEvents as seedEvents } from "../data/schedule";
import { scheduleRoomOptions, scheduleTeacherOptions } from "../data/pageStats";
import { generateId } from "./config";
import { ApiClientError, apiClient, createApiCallState, setApiError, setApiLoading, setApiSuccess } from "./apiClient";

export type CreateScheduleInput = {
  studentId?: string;
  classId?: string;
  courseId?: string;
  courseName: string;
  teacherId?: string;
  teacher: string;
  roomId?: string;
  classroom?: string;
  date: string;
  startTime: string;
  endTime?: string;
  duration: number;
  consumedHours?: number;
  lessonType?: "class" | "exam" | "meeting";
  status?: ScheduleStatus;
  notes?: string;
};

export type UpdateScheduleInput = {
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  teacherId?: string;
  roomId?: string;
  classroom?: string;
  status?: ScheduleStatus;
  cancelReason?: string;
  notes?: string;
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
  status?: ScheduleStatus | "" | null;
};

export const scheduleApiState = {
  list: createApiCallState<Schedule[]>(),
  create: createApiCallState<{ event: Schedule; hasConflict: boolean }>(),
  update: createApiCallState<Schedule>(),
};

function isUuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveRoomLabel(roomId: string | undefined): string {
  if (!roomId) return "";
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
  const classroom = input.classroom ?? resolveRoomLabel(input.roomId);
  return {
    studentId: input.studentId,
    classId: input.classId,
    courseId: input.courseId,
    courseName: input.courseName,
    teacherId: input.teacherId,
    teacher: input.teacher,
    roomId: isUuid(input.roomId) ? input.roomId : undefined,
    classroom,
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

function shouldUseMockFallback(error: unknown) {
  return !(error instanceof ApiClientError);
}

function formatApiError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const endpoint = `${error.method ?? "GET"} ${error.url ?? ""}`.trim();
    return `${endpoint}：${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
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
    const path = `/schedules${buildScheduleQuery(filters)}`;
    setApiLoading(scheduleApiState.list);
    try {
      const data = await apiClient.request<Schedule[]>(path, { method: "GET" });
      setApiSuccess(scheduleApiState.list, data);
      return data;
    } catch (error) {
      const message = formatApiError(error, "排课列表查询失败");
      setApiError(scheduleApiState.list, message);
      if (shouldUseMockFallback(error)) return [...seedEvents];
      throw new Error(message);
    }
  },

  /** 新建排课 */
  async createSchedule(input: CreateScheduleInput, existingEvents: Schedule[] = []): Promise<{
    event: Schedule;
    hasConflict: boolean;
  }> {
    setApiLoading(scheduleApiState.create);
    try {
      const data = await apiClient.request<{ event: Schedule; hasConflict: boolean }>(
        "/schedules",
        { method: "POST", body: JSON.stringify(toCreateSchedulePayload(input)) }
      );
      setApiSuccess(scheduleApiState.create, data);
      return data;
    } catch (error) {
      const message = formatApiError(error, "排课创建失败");
      setApiError(scheduleApiState.create, message);
      if (shouldUseMockFallback(error)) {
        const event = buildScheduleEvent(input);
        const hasConflict = detectConflict(event, existingEvents);
        return { event, hasConflict };
      }
      throw new Error(message);
    }
  },

  async updateSchedule(eventId: string, input: UpdateScheduleInput): Promise<Schedule> {
    setApiLoading(scheduleApiState.update);
    try {
      const payload = {
        ...input,
        roomId: isUuid(input.roomId) ? input.roomId : undefined,
        classroom: input.classroom ?? resolveRoomLabel(input.roomId),
      };
      const data = await apiClient.request<Schedule>(
        `/schedules/${eventId}`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
      setApiSuccess(scheduleApiState.update, data);
      return data;
    } catch (error) {
      const message = formatApiError(error, "排课更新失败");
      setApiError(scheduleApiState.update, message);
      throw new Error(message);
    }
  },

  async updateScheduleStatus(eventId: string, input: { status: ScheduleStatus; cancelReason?: string; notes?: string }): Promise<Schedule> {
    setApiLoading(scheduleApiState.update);
    try {
      const data = await apiClient.request<Schedule>(
        `/schedules/${eventId}/status`,
        { method: "PATCH", body: JSON.stringify(input) }
      );
      setApiSuccess(scheduleApiState.update, data);
      return data;
    } catch (error) {
      const message = formatApiError(error, "排课状态更新失败");
      setApiError(scheduleApiState.update, message);
      throw new Error(message);
    }
  },

  /** 取消排课 */
  async cancelSchedule(eventId: string, cancelReason: string): Promise<Schedule> {
    return this.updateScheduleStatus(eventId, { status: "cancelled", cancelReason });
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
