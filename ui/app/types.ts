export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export interface SubRequirement {
  name: string;
  completed: number;
  total: number;
  note?: string;
}

export interface RequirementGroup {
  id: string;
  name: string;
  color: string;
  subcategories: SubRequirement[];
}

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export interface CourseBlock {
  id: string;
  name: string;
  days: Day[];
  /** Decimal hour, e.g. 10.5 = 10:30 AM */
  startHour: number;
  endHour: number;
  color: string;
  units: number;
}

export interface StudentProfile {
  name: string;
  year: "Freshman" | "Sophomore" | "Junior" | "Senior" | "MEng";
  major: string;
}
