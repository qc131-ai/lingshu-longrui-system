import type { Teacher } from "../types";

export const teachers: Teacher[] = [
  { id: "T001", name: "王建国", subjects: ["AP微积分", "SAT数学"], type: "full-time", rating: 4.8, classesCount: 5 },
  { id: "T002", name: "李明", subjects: ["AMC", "AIME"], type: "full-time", rating: 4.9, classesCount: 4 },
  { id: "T003", name: "Sarah", subjects: ["托福听力", "托福口语"], type: "part-time", rating: 4.6, classesCount: 3 },
  { id: "T004", name: "张伟", subjects: ["AP物理1", "物理碗"], type: "full-time", rating: 4.7, classesCount: 6 },
];
