import type { Student } from "../types";

export const students: Student[] = [
  { id: "S001", name: "张子涵", grade: "10年级", school: "人大附中", phone: "13800000001", remainingCredits: 20, riskStatus: "low", tags: ["AP", "竞赛苗子"], enrollmentDate: "2023-09-01", recentTestScore: 95 },
  { id: "S002", name: "李佳怡", grade: "11年级", school: "十一学校", phone: "13800000002", remainingCredits: 5, riskStatus: "high", tags: ["托福", "需关注进度"], enrollmentDate: "2023-10-15", recentTestScore: 82 },
  { id: "S003", name: "王宇航", grade: "9年级", school: "四中", phone: "13800000003", remainingCredits: 12, riskStatus: "medium", tags: ["基础薄弱"], enrollmentDate: "2024-02-10", recentTestScore: 78 },
  { id: "S004", name: "赵诗琪", grade: "12年级", school: "清华附中", phone: "13800000004", remainingCredits: 40, riskStatus: "low", tags: ["冲刺名校", "AP全科"], enrollmentDate: "2022-09-01", recentTestScore: 115 },
  { id: "S005", name: "刘星宇", grade: "10年级", school: "北师大附属", phone: "13800000005", remainingCredits: 0, riskStatus: "high", tags: ["续费预警"], enrollmentDate: "2023-11-20" },
];
