import type { AIChatHistoryItem } from "../types";

export const aiChatHistory: AIChatHistoryItem[] = [
  { id: 1, title: "分析张子涵的学习数据", date: "今天" },
  { id: 2, title: "生成托福春季班排课方案", date: "昨天" },
  { id: 3, title: "提取教研会议纪要重点", date: "昨天" },
  { id: 4, title: "撰写 AMC10 招生文案", date: "本周" },
];

export const makeupReminderItems = [
  "李佳怡 - AP微积分 (因病请假)",
  "王宇轩 - 托福口语 (老师调课)",
  "张子涵 - AMC10 (冲突取消)",
];

/** @deprecated */
export const mockAIChatHistory = aiChatHistory;
