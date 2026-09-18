export type Role = "teacher" | "student";

export interface StudentProfile {
  name: string;
  interests: string[];
  learningStyle: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  concept: string;
  contextTag: string;
}

/** Question sent to the browser (correct answer stripped) */
export interface SafeQuestion {
  id: string;
  text: string;
  options: string[];
  concept: string;
}

export interface QuestionResult {
  attempts: number;
  solved: boolean;
  done: boolean;
}

export interface ReportData {
  mastery: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

export interface AdaptiveResult {
  message: string;
  question: Question;
}

export interface SessionSummary {
  questionText: string;
  chosenText: string;
  correctText: string;
  concept: string;
  attempts: number;
  solved: boolean;
}

export interface UserRow {
  id: number;
  email: string;
  password: string;
  name: string;
  role: Role;
  interests: string;
  learning_style: string;
  profile_completed: number;
  created_at: string;
}

export interface AssignmentRow {
  id: number;
  teacher_id: number;
  title: string;
  content: string;
  file_name: string | null;
  created_at: string;
}

export interface SessionRow {
  id: number;
  assignment_id: number;
  student_id: number;
  status: "active" | "completed";
  questions: string;
  results: string;
  mastery: number;
  started_at: string;
  finished_at: string | null;
}

export interface ReportRow {
  id: number;
  session_id: number | null;
  student_id: number;
  assignment_id: number;
  assignment_title: string;
  mastery: number;
  strengths: string;
  weaknesses: string;
  feedback: string;
  created_at: string;
}
