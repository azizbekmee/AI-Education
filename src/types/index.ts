export type Role = "teacher" | "student";

export interface StudentProfile {
  name: string;
  interests: string[];
  learningStyle: string;
}

/* ---------- Original assignment (immutable, extracted from teacher files) ---------- */

export type OriginalAnswerType = "numeric" | "short" | "free";

export interface OriginalQuestion {
  /** Verbatim question text from the teacher's file */
  text: string;
  /** Expected answer / solution reference (never shown directly to the student) */
  answer: string;
  answerType: OriginalAnswerType;
}

export interface OriginalAssignment {
  title: string;
  /** Verbatim instructions/requirements from the file (word counts, sections, criteria…) */
  requirements: string[];
  questions: OriginalQuestion[];
  /** Anything else the teacher's file demands (grading criteria, constraints, notes) */
  constraints: string;
  /** Full extracted text of all files, kept verbatim */
  rawText: string;
}

export interface AssignmentFileMeta {
  name: string;
  size: number;
  type: string;
}

/* ---------- Work modes (student choice, fixed for the whole session) ---------- */

export type WorkMode = "test" | "quiz" | "puzzle";

export const WORK_MODES: { id: WorkMode; label: string; desc: string; icon: string }[] = [
  {
    id: "test",
    label: "Multiple Choice",
    desc: "Har bir savol variantlar bilan beriladi — javobni tanlaysan.",
    icon: "🎯",
  },
  {
    id: "quiz",
    label: "Viktorina",
    desc: "Savollar navbatma-navbat, tez javobli formatda.",
    icon: "⚡",
  },
  {
    id: "puzzle",
    label: "Qiziqarli Puzzle",
    desc: "Savollar qulf va bosqichli tapshiriq ko'rinishida.",
    icon: "🧩",
  },
];

export const MOODS = [
  { id: "great", emoji: "😊", label: "Zo'r" },
  { id: "good", emoji: "🙂", label: "Yaxshi" },
  { id: "ok", emoji: "😐", label: "Oddiy" },
  { id: "tired", emoji: "😓", label: "Charchagan" },
  { id: "struggling", emoji: "😕", label: "Biroz qiynalyapman" },
];

/* ---------- Activities (rendered by the frontend) ---------- */

/** Primitive interaction kinds — extensible; unknown kinds degrade to free_response */
export type ActivityKind = "choice" | "numeric" | "ordering" | "free_response";

export interface Activity {
  id: string;
  kind: ActivityKind;
  /** which part of the original assignment this step checks */
  concept: string;
  prompt: string;
  title?: string;
  /** true when this activity is an extra practice problem, not part of the original */
  isPractice?: boolean;
  /* choice */
  options?: string[];
  correctIndex?: number;
  /* numeric */
  acceptedAnswers?: string[];
  /* ordering */
  items?: string[];
  correctOrder?: string[];
  /* human-readable solution shown only on reveal */
  solution: string;
}

/** Activity sent to the browser (answers stripped) */
export type SafeActivity = Omit<Activity, "correctIndex" | "acceptedAnswers" | "correctOrder" | "solution">;

export interface Experience {
  id: string;
  title: string;
  typeLabel: string;
  icon: string;
  intro: string;
  objective: string;
  /** set once the session picks a work mode (Phase: student flow); optional for the current flow */
  workMode?: WorkMode;
  mood?: string;
  activities: Activity[];
}

export interface SafeExperience {
  id: string;
  title: string;
  typeLabel: string;
  icon: string;
  intro: string;
  objective: string;
  workMode?: WorkMode;
  mood?: string;
  activities: SafeActivity[];
}

/* ---------- Remediation ladder (stage-based help, answer never given directly) ---------- */

export interface LadderStage {
  /** 1 hint · 2 guiding question · 3 practice · 4 explanation · 5 checking example · 6 teach-back */
  step: number;
  kind: "message" | "activity";
  route: string;
  text: string;
  activity?: Activity;
}

/** Per-question stored state inside a session */
export interface QuestionResult {
  attempts: number;
  solved: boolean;
  done: boolean;
  /** current position: 0 = answering the original question, 1..6 = ladder stage active, 7 = ladder done */
  stage: number;
  /** ladder content generated on the first mistake (stored so it survives save/resume) */
  ladder: LadderStage[];
  hintsUsed: number;
  practiceDone: number;
  practiceSolved: number;
  routes: string[];
  revealed: boolean;
}

export type AnswerPayload = {
  kind: "choice" | "numeric" | "ordering" | "free";
  index?: number;
  value?: string;
  order?: string[];
  text?: string;
};

export interface ReportData {
  mastery: number;
  strengths: string[];
  weaknesses: string[];
  /** student-facing, "sen" form */
  feedback: string;
  /** teacher-facing, 3rd person personalization insight */
  insight: string;
}

export interface TopicMastery {
  topic: string;
  mastery: number;
}

export interface SessionSummary {
  concept: string;
  kind: string;
  attempts: number;
  solved: boolean;
  hintsUsed?: number;
  practiceDone?: number;
  routes: string[];
}

/* ---------- DB rows ---------- */

export interface UserRow {
  id: number;
  email: string;
  password: string;
  name: string;
  role: Role;
  class_id: number | null;
  subject_id: number | null;
  interests: string;
  learning_style: string;
  profile_completed: number;
  created_at: string;
}

export interface ClassRow {
  id: number;
  name: string;
  grade: number;
}

/** A lesson shown on the teacher's / student's timetable */
export interface TodayLesson {
  timetableId: number;
  lessonNumber: number;
  startTime: string;
  classId: number;
  className: string;
  grade: number;
  subjectName: string;
}

export const WEEKDAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

export interface SubjectRow {
  id: number;
  name: string;
}

export interface TopicRow {
  id: number;
  subject_id: number;
  grade: number;
  name: string;
}

export interface TimetableRow {
  id: number;
  day_of_week: number;
  lesson_number: number;
  start_time: string;
  class_id: number;
  subject_id: number;
  teacher_id: number | null;
}

export interface AssignmentRow {
  id: number;
  teacher_id: number;
  class_id: number | null;
  subject_id: number | null;
  topic_id: number | null;
  title: string;
  /** plain-text source fed to the personalization engine (derived from original + files + note) */
  content: string;
  note: string;
  original: string | null; // JSON: OriginalAssignment (null on legacy rows — synthesize from content)
  deadline: string | null;
  created_at: string;
}

export interface AssignmentFileRow {
  id: number;
  assignment_id: number;
  name: string;
  size: number;
  type: string; // mime type
  /** original file content, base64 (PDF/images) or raw text — source of truth for Phase 2 extraction */
  data: string | null;
  extracted_text: string;
}

export interface SessionRow {
  id: number;
  assignment_id: number;
  student_id: number;
  status: "active" | "completed";
  questions: string; // JSON: Experience[]
  results: string; // JSON: QuestionResult[]
  mastery: number;
  today_interest: string; // legacy personalization input, kept for existing flow
  mood: string;
  work_mode: string;
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
  insight: string;
  topic_breakdown: string; // JSON: TopicMastery[]
  created_at: string;
}
