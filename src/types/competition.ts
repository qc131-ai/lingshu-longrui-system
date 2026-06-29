export type Competition = {
  id: string;
  name: string;
  studentId: string;
  studentName: string;
  advisor: string;
  status: "enrolled" | "training" | "preliminary" | "final" | "completed";
  deadline: string;
  nextMilestone: string;
  progress: number;
  result?: string;
};
