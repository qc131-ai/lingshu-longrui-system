export type Teacher = {
  id: string;
  name: string;
  subjects: string[];
  type: "full-time" | "part-time";
  rating: number;
  classesCount: number;
  availableTime?: string[];
  feedbackRate?: number;
  userId?: string;
  status?: string;
  classes?: Array<{ id: string; name: string }>;
};
