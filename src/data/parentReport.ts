import type { ParentReport } from "../types";

export const defaultParentReport: ParentReport = {
  studentName: "张子涵",
  grade: "10年级",
  courses: "托福冲刺 / AP微积分",
  advisor: "Liang Director",
  period: "2024年3月 · 月度总结",
  monthlyHours: 12,
  attendanceRate: 100,
  homeworkRate: 95,
  scoreImprovement: 12,
  courseRecords: [
    {
      date: "03-25",
      course: "托福冲刺晚班",
      topic: "听力讲座精听",
      teacher: "Sarah",
      feedback: "课堂专注，跟读练习完成度高，注意连读发音技巧。",
    },
    {
      date: "03-20",
      course: "AP微积分BC",
      topic: "导数应用综合",
      teacher: "王建国",
      feedback: "计算准确率达90%，但答题步骤需要更加规范，已布置针对性课后作业。",
    },
  ],
};

export const parentReportSummaryTemplate =
  "子涵家长您好！本月子涵在托福和AP微积分的学习中表现出了极高的专注度。尤其在托福听力板块，通过近期的专项精听训练，细节捕捉能力显著提升。微积分方面，对于导数应用部分掌握较好，但在综合题型的解题速度上还有提升空间。\n\n下阶段我们将重点进行托福口语的串讲，并增加微积分的计时训练。孩子目前的学习状态非常棒，继续保持一定能取得理想成绩！";
