import type { DashboardChartPoint, DashboardTask } from "../types";

export const dashboardChartData: DashboardChartPoint[] = [
  { name: "Jan", revenue: 4000, students: 240 },
  { name: "Feb", revenue: 3000, students: 139 },
  { name: "Mar", revenue: 2000, students: 980 },
  { name: "Apr", revenue: 2780, students: 390 },
  { name: "May", revenue: 1890, students: 480 },
  { name: "Jun", revenue: 2390, students: 380 },
  { name: "Jul", revenue: 3490, students: 430 },
];

export const dashboardTasks: DashboardTask[] = [
  { title: "跟进续费预警学员", time: "10:00 AM", type: "urgent" },
  { title: "审核请假申请", time: "14:00 PM", type: "normal" },
  { title: "排课冲突处理", time: "16:00 PM", type: "warning" },
];
