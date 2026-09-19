import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/helpers";
import type { ReportRow, SessionRow } from "@/types";

export interface StudentSummary {
  id: number;
  name: string;
  email: string;
  learning_style: string;
  interests: string[];
  assignmentCount: number;
  completedCount: number;
  inProgressCount: number;
  avgMastery: number | null;
  lastActivity: string | null;
}

export interface ClassAnalytics {
  className: string;
  grade: number;
  students: StudentSummary[];
  avgMastery: number;
  completionRate: number;
  attention: StudentSummary[];
  topics: { topic: string; avgMastery: number; students: number }[];
  commonMistakes: { text: string; count: number }[];
}

/** Teacher must be linked to the class via teacher_class. */
export function isTeacherOfClass(teacherId: number, classId: number): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM teacher_class WHERE teacher_id = ? AND class_id = ?").get(teacherId, classId)
  );
}

export function getClassAnalytics(teacherId: number, classId: number): ClassAnalytics | null {
  if (!isTeacherOfClass(teacherId, classId)) return null;
  const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as
    | { id: number; name: string; grade: number }
    | undefined;
  if (!cls) return null;

  const students = db
    .prepare(
      `SELECT id, name, email, learning_style, interests FROM users
       WHERE role = 'student' AND class_id = ? ORDER BY name`
    )
    .all(classId) as { id: number; name: string; email: string; learning_style: string; interests: string }[];

  const assignmentCount = (
    db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE class_id = ?").get(classId) as { c: number }
  ).c;

  const summaries: StudentSummary[] = [];
  for (const s of students) {
    const sessions = db
      .prepare(
        `SELECT se.* FROM sessions se JOIN assignments a ON a.id = se.assignment_id
         WHERE se.student_id = ? AND a.class_id = ?`
      )
      .all(s.id, classId) as SessionRow[];
    const completed = sessions.filter((x) => x.status === "completed");
    const inProgress = sessions.filter((x) => x.status === "active");
    const masteries = completed.map((x) => x.mastery ?? 0).filter((m) => m > 0);
    const lastActivity = db
      .prepare(
        `SELECT MAX(created_at) AS d FROM reports WHERE student_id = ?
         UNION ALL SELECT MAX(started_at) FROM sessions WHERE student_id = ?`
      )
      .all(s.id, s.id) as { d: string | null }[];
    summaries.push({
      id: s.id,
      name: s.name,
      email: s.email,
      learning_style: s.learning_style,
      interests: parseJsonArray(s.interests, [] as string[]),
      assignmentCount,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      avgMastery: masteries.length ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : null,
      lastActivity: lastActivity.map((r) => r.d).filter(Boolean).sort().pop() ?? null,
    });
  }

  const withMastery = summaries.filter((s) => s.avgMastery !== null);
  const avgMastery = withMastery.length
    ? Math.round(withMastery.reduce((a, s) => a + (s.avgMastery ?? 0), 0) / withMastery.length)
    : 0;
  const totalDone = summaries.reduce((a, s) => a + s.completedCount, 0);
  const totalExpected = summaries.reduce((a, s) => a + s.assignmentCount, 0);
  const completionRate = totalExpected ? Math.round((totalDone / totalExpected) * 100) : 0;

  // Students who need attention: weak mastery or many untouched assignments
  const attention = summaries
    .filter(
      (s) =>
        (s.avgMastery !== null && s.avgMastery < 60) ||
        (s.assignmentCount > 0 && s.completedCount === 0 && s.inProgressCount === 0)
    )
    .sort((a, b) => (a.avgMastery ?? 0) - (b.avgMastery ?? 0));

  // Class-level topic mastery and most common mistakes, aggregated from reports
  const reportRows = db
    .prepare(
      `SELECT r.topic_breakdown, r.weaknesses FROM reports r
       JOIN sessions s ON s.id = r.session_id
       JOIN assignments a ON a.id = s.assignment_id
       WHERE a.class_id = ?`
    )
    .all(classId) as { topic_breakdown: string; weaknesses: string }[];
  const topicAgg = new Map<string, { sum: number; n: number }>();
  const mistakeAgg = new Map<string, number>();
  for (const r of reportRows) {
    for (const t of parseJsonArray(r.topic_breakdown, [] as { topic: string; mastery: number }[])) {
      const cur = topicAgg.get(t.topic) ?? { sum: 0, n: 0 };
      cur.sum += t.mastery;
      cur.n += 1;
      topicAgg.set(t.topic, cur);
    }
    for (const w of parseJsonArray(r.weaknesses, [] as string[])) {
      mistakeAgg.set(w, (mistakeAgg.get(w) ?? 0) + 1);
    }
  }
  const topics = [...topicAgg.entries()]
    .map(([topic, v]) => ({ topic, avgMastery: Math.round(v.sum / v.n), students: v.n }))
    .sort((a, b) => a.avgMastery - b.avgMastery);
  const commonMistakes = [...mistakeAgg.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    className: cls.name,
    grade: cls.grade,
    students: summaries,
    avgMastery,
    completionRate,
    attention,
    topics,
    commonMistakes,
  };
}

export interface StudentAnalytics {
  student: { id: number; name: string; email: string; className: string; learningStyle: string; interests: string[] };
  reports: {
    id: number;
    assignmentTitle: string;
    mastery: number;
    strengths: string[];
    weaknesses: string[];
    feedback: string;
    insight: string;
    createdAt: string;
  }[];
  avgMastery: number;
  dynamics: { label: string; mastery: number }[];
  topicBreakdown: { topic: string; mastery: number }[];
  strengths: string[];
  weaknesses: string[];
  engagement: {
    sessionsTotal: number;
    completed: number;
    avgHintsUsed: number;
    avgAttempts: number;
    practiceSolved: number;
  };
  aiInsight: string | null;
}

/** Teacher must be linked to the student's class via teacher_class. */
export function getStudentAnalytics(teacherId: number, studentId: number): StudentAnalytics | null {
  const student = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.learning_style, u.interests, c.name AS class_name, c.id AS class_id
       FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND u.role = 'student'`
    )
    .get(studentId) as
    | { id: number; name: string; email: string; learning_style: string; interests: string; class_name: string | null; class_id: number | null }
    | undefined;
  if (!student?.class_id || !isTeacherOfClass(teacherId, student.class_id)) return null;

  const reportRows = db
    .prepare("SELECT * FROM reports WHERE student_id = ? ORDER BY id ASC")
    .all(studentId) as ReportRow[];

  const reports = reportRows.map((r) => ({
    id: r.id,
    assignmentTitle: r.assignment_title,
    mastery: Math.round(r.mastery),
    strengths: parseJsonArray(r.strengths, [] as string[]),
    weaknesses: parseJsonArray(r.weaknesses, [] as string[]),
    feedback: r.feedback,
    insight: r.insight,
    createdAt: r.created_at,
  }));

  const avgMastery = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.mastery, 0) / reports.length)
    : 0;

  const dynamics = reports.map((r) => ({ label: r.assignmentTitle, mastery: r.mastery }));

  // aggregate topic breakdown across reports
  const topicMap = new Map<string, { sum: number; n: number }>();
  for (const r of reportRows) {
    const rows = parseJsonArray(r.topic_breakdown, [] as { topic: string; mastery: number }[]);
    for (const t of rows) {
      const cur = topicMap.get(t.topic) ?? { sum: 0, n: 0 };
      cur.sum += t.mastery;
      cur.n += 1;
      topicMap.set(t.topic, cur);
    }
  }
  const topicBreakdown = [...topicMap.entries()].map(([topic, v]) => ({
    topic,
    mastery: Math.round(v.sum / v.n),
  }));

  const strengths = [...new Set(reports.flatMap((r) => r.strengths))];
  const weaknesses = [...new Set(reports.flatMap((r) => r.weaknesses))];

  const sessions = db
    .prepare("SELECT * FROM sessions WHERE student_id = ?")
    .all(studentId) as SessionRow[];
  const completedSessions = sessions.filter((s) => s.status === "completed");
  let hints = 0;
  let attempts = 0;
  let practiceSolved = 0;
  for (const s of completedSessions) {
    const results = parseJsonArray(
      s.results,
      [] as { attempts?: number; hintsUsed?: number; practiceSolved?: number }[]
    );
    for (const r of results) {
      attempts += r.attempts ?? 0;
      hints += r.hintsUsed ?? 0;
      practiceSolved += r.practiceSolved ?? 0;
    }
  }
  const n = completedSessions.length || 1;

  const lastInsight = [...reports].reverse().find((r) => r.insight)?.insight ?? null;

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      className: student.class_name ?? "—",
      learningStyle: student.learning_style || "ko'rsatilmagan",
      interests: parseJsonArray(student.interests, [] as string[]),
    },
    reports,
    avgMastery,
    dynamics,
    topicBreakdown,
    strengths,
    weaknesses,
    engagement: {
      sessionsTotal: sessions.length,
      completed: completedSessions.length,
      avgHintsUsed: Math.round((hints / n) * 10) / 10,
      avgAttempts: Math.round((attempts / n) * 10) / 10,
      practiceSolved,
    },
    aiInsight: lastInsight,
  };
}
