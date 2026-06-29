export type Schedule = {
  id: string;
  colIndex: number;
  topIndex: number;
  durationSlots: number;
  title: string;
  teacher: string;
  room: string;
  timeString: string;
  type: string;
};

/** @deprecated 使用 Schedule */
export type ScheduleEvent = Schedule;
