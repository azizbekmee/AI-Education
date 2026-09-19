import { db } from "@/lib/db";
import type { ClassRow, SubjectRow, TodayLesson, TopicRow } from "@/types";

export const WEEKDAYS_UZ = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

/** Today's day-of-week in the timetable numbering (1=Dushanba … 6=Shanba; 7=Yakshanba) */
export function todayDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function getTeacherSubject(teacherId: number): SubjectRow | null {
  return (
    (db
      .prepare(
        `SELECT s.* FROM subjects s JOIN teacher_subject ts ON ts.subject_id = s.id
         WHERE ts.teacher_id = ? LIMIT 1`
      )
      .get(teacherId) as SubjectRow | undefined) ?? null
  );
}

export function getTeacherClasses(teacherId: number): ClassRow[] {
  return db
    .prepare(
      `SELECT c.* FROM classes c JOIN teacher_class tc ON tc.class_id = c.id
       WHERE tc.teacher_id = ? ORDER BY c.grade, c.name`
    )
    .all(teacherId) as ClassRow[];
}

export function getTeacherTopics(teacherId: number): TopicRow[] {
  return db
    .prepare(
      `SELECT t.* FROM topics t JOIN teacher_topic tt ON tt.topic_id = t.id
       WHERE tt.teacher_id = ? ORDER BY t.grade, t.id`
    )
    .all(teacherId) as TopicRow[];
}

/** All lessons are 45 minutes long, with a 5-minute break between slots. */
export const LESSON_DURATION_MIN = 45;

/** "08:00" → "08:45" */
export function lessonEndTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + LESSON_DURATION_MIN;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface TeacherLesson extends TodayLesson {
  dayOfWeek: number;
  subjectId: number;
  endTime: string;
}

export function getTeacherLessons(teacherId: number, dayOfWeek?: number): TeacherLesson[] {
  const where = dayOfWeek ? "AND t.day_of_week = ?" : "";
  const params = dayOfWeek ? [teacherId, dayOfWeek] : [teacherId];
  const rows = db
    .prepare(
      `SELECT t.id timetableId, t.day_of_week dayOfWeek, t.lesson_number lessonNumber, t.start_time startTime,
              c.id classId, c.name className, c.grade, s.name subjectName, s.id subjectId
       FROM timetable t
       JOIN classes c ON c.id = t.class_id
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.teacher_id = ? ${where}
       ORDER BY t.day_of_week, t.lesson_number`
    )
    .all(...params) as unknown as TeacherLesson[];
  return rows.map((l) => ({ ...l, endTime: lessonEndTime(l.startTime) }));
}

export interface ClassLesson {
  timetableId: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  subjectName: string;
  teacherName: string | null;
}

/** A class's lessons for one weekday, with subject and teacher names resolved. */
export function getClassLessons(classId: number, dayOfWeek: number): ClassLesson[] {
  const rows = db
    .prepare(
      `SELECT t.id timetableId, t.lesson_number lessonNumber, t.start_time startTime,
              s.id subjectId, s.name subjectName, u.name teacherName
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
       LEFT JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? AND t.day_of_week = ?
       ORDER BY t.lesson_number`
    )
    .all(classId, dayOfWeek) as unknown as ClassLesson[];
  return rows.map((l) => ({ ...l, endTime: lessonEndTime(l.startTime) }));
}

/** The upcoming lesson closest to now from a list of lessons (same-day past lessons roll to next week). */
export function findNextLesson(
  lessons: TeacherLesson[],
  dow: number,
  now: Date = new Date()
): TeacherLesson | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: TeacherLesson | null = null;
  let bestKey = Infinity;
  for (const l of lessons) {
    const dayDiff = (l.dayOfWeek - dow + 7) % 7;
    const [h, m] = l.startTime.split(":").map(Number);
    const startMin = (h || 0) * 60 + (m || 0);
    const diff = dayDiff === 0 && startMin <= nowMin ? 7 : dayDiff;
    const key = diff * 1440 + startMin;
    if (key < bestKey) {
      bestKey = key;
      best = l;
    }
  }
  return best;
}

export function formatNextLesson(l: TeacherLesson | null, dow: number): string {
  if (!l) return "Rejalashtirilmagan";
  const dayDiff = (l.dayOfWeek - dow + 7) % 7;
  const dayLabel = dayDiff === 0 ? "Bugun" : dayDiff === 1 ? "Ertaga" : WEEKDAYS_UZ[l.dayOfWeek];
  return `${dayLabel}, ${l.startTime}`;
}

export interface AssignmentTarget {
  ok: true;
  subjectId: number;
  classId: number;
  className: string;
  grade: number;
  topicId: number;
  topicName: string;
}
export interface AssignmentTargetError {
  ok: false;
  error: string;
}

/**
 * Server-side authorization: verifies the teacher is actually assigned to the
 * class, subject and topic of an assignment request. Rejects any combination
 * that is not pre-assigned in the database.
 */
export function validateAssignmentTarget(
  teacherId: number,
  classId: number,
  topicId: number
): AssignmentTarget | AssignmentTargetError {
  const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as ClassRow | undefined;
  if (!cls) return { ok: false, error: "Sinf topilmadi." };

  const bound = db
    .prepare("SELECT 1 FROM teacher_class WHERE teacher_id = ? AND class_id = ?")
    .get(teacherId, classId);
  if (!bound) return { ok: false, error: "Bu sinf sizga biriktirilmagan." };

  const subject = getTeacherSubject(teacherId);
  if (!subject) return { ok: false, error: "Sizga fan biriktirilmagan." };

  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(topicId) as TopicRow | undefined;
  if (!topic) return { ok: false, error: "Mavzu topilmadi." };
  if (topic.subject_id !== subject.id) return { ok: false, error: "Bu mavzu sizning faningizga tegishli emas." };
  if (topic.grade !== cls.grade) return { ok: false, error: "Bu mavzu tanlangan sinf darajasiga mos emas." };

  const topicBound = db
    .prepare("SELECT 1 FROM teacher_topic WHERE teacher_id = ? AND topic_id = ?")
    .get(teacherId, topicId);
  if (!topicBound) return { ok: false, error: "Bu mavzu sizga biriktirilmagan." };

  return {
    ok: true,
    subjectId: subject.id,
    classId: cls.id,
    className: cls.name,
    grade: cls.grade,
    topicId: topic.id,
    topicName: topic.name,
  };
}
