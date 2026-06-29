import type { Course } from "../types";

export const courses: Course[] = [
  { id: "C001", name: "AP微积分BC保5分班", category: "math", level: "AP", totalLessons: 30, price: 15000 },
  { id: "C002", name: "AMC 10 冲刺营", category: "competition", level: "AMC10", totalLessons: 20, price: 12000 },
  { id: "C003", name: "托福核心词汇突破", category: "chemistry", level: "TOEFL", totalLessons: 15, price: 8000 },
  { id: "C004", name: "物理碗冲刺指导", category: "physics", level: "Competition", totalLessons: 25, price: 18000 },
];
