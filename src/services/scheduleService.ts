import type { Schedule } from "../types";
import { scheduleEvents as seedEvents } from "../data/schedule";
import { scheduleRoomOptions, scheduleTeacherOptions } from "../data/pageStats";
import { generateId } from "./config";
import { apiClient, createApiCallState } from "./apiClient";

export type CreateScheduleInput = {
  courseName: string;
  teacher: string;
  roomId: string;
  date: string;
  startTime: string;
  duration: number;
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

function detectConflict(newEvent: Schedule, existing: Schedule[]): boolean {
  return existing.some(
    (ev) =>
      ev.colIndex === newEvent.colIndex &&
      ((newEvent.topIndex >= ev.topIndex && newEvent.topIndex < ev.topIndex + ev.durationSlots) ||
        (ev.topIndex >= newEvent.topIndex && ev.topIndex < newEvent.topIndex + newEvent.durationSlots))
  );
}

export const scheduleService = {
  async listEvents(): Promise<Schedule[]> {
    return apiClient.requestWithFallback<Schedule[]>(
      "/schedules",
      { method: "GET" },
      () => [...seedEvents],
      scheduleApiState.list
    );
  },

  /** 新建排课 */
  async createSchedule(input: CreateScheduleInput, existingEvents: Schedule[] = []): Promise<{
    event: Schedule;
    hasConflict: boolean;
  }> {
    return apiClient.requestWithFallback<{ event: Schedule; hasConflict: boolean }>(
      "/schedules",
      { method: "POST", body: JSON.stringify(input) },
      () => {
      const event = buildScheduleEvent(input);
      const hasConflict = detectConflict(event, existingEvents);
      return { event, hasConflict };
      },
      scheduleApiState.create
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
      scheduleApiState.update
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
