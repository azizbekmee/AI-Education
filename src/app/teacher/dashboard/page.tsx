import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FileText,
  Gauge,
  Plus,
  BookOpen,
  Clock,
  CalendarDays,
  GraduationCap,
  Layers,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  findNextLesson,
  formatNextLesson,
  getTeacherClasses,
  getTeacherLessons,
  getTeacherSubject,
  todayDow,
  WEEKDAYS_UZ,
  type TeacherLesson,
} from "@/lib/teacher-context";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import NotificationsBell from "@/components/NotificationsBell";
import type { ClassRow } from "@/types";

export const dynamic = "force-dynamic";

interface RecentAssignment {
  id: number;
  title: string;
  note: string;
  deadline: string | null;
  created_at: string;
  class_name: string | null;
  topic_name: string | null;
  student_count: number;
  completed_count: number;
  avg_mastery: number;
}

export default async function TeacherDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/student");

  const subject = getTeacherSubject(user.id);
  const classes = getTeacherClasses(user.id);
  const dow = todayDow();
  const allLessons = getTeacherLessons(user.id);
  const todayLessons = allLessons.filter((l) => l.dayOfWeek === dow);

  const lessonsByClass = new Map<number, TeacherLesson[]>();
  for (const l of allLessons) {
    const list = lessonsByClass.get(l.classId) ?? [];
    list.push(l);
    lessonsByClass.set(l.classId, list);
  }
  const weeklyClassCount = lessonsByClass.size;
  const unread = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };

  const classIds = classes.map((c: ClassRow) => c.id);
  const placeholders = classIds.map(() => "?").join(",") || "NULL";

  const studentCount = classIds.length
    ? (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM users WHERE role = 'student' AND class_id IN (${placeholders})`
          )
          .get(...classIds) as { c: number }
      ).c
    : 0;

  const assignmentCount = (
    db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE teacher_id = ?").get(user.id) as {
      c: number;
    }
  ).c;

  const avgMastery = classIds.length
    ? Math.round(
        (
          db
            .prepare(
              `SELECT COALESCE(AVG(r.mastery), 0) AS m FROM reports r
               JOIN users u ON u.id = r.student_id
               WHERE u.role = 'student' AND u.class_id IN (${placeholders})`
            )
            .get(...classIds) as { m: number }
        ).m
      )
    : 0;

  const recent = db
    .prepare(
      `SELECT a.id, a.title, a.note, a.deadline, a.created_at,
              c.name AS class_name, t.name AS topic_name,
              (SELECT COUNT(*) FROM users u WHERE u.role = 'student' AND u.class_id = a.class_id) AS student_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.assignment_id = a.id AND s.status = 'completed') AS completed_count,
              (SELECT COALESCE(ROUND(AVG(s2.mastery)), 0) FROM sessions s2 WHERE s2.assignment_id = a.id AND s2.status = 'completed') AS avg_mastery
       FROM assignments a
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN topics t ON t.id = a.topic_id
       WHERE a.teacher_id = ?
       ORDER BY a.id DESC LIMIT 6`
    )
    .all(user.id) as RecentAssignment[];

  const studentCountByClass = new Map<number, number>();
  if (classIds.length) {
    const rows = db
      .prepare(
        `SELECT class_id, COUNT(*) AS c FROM users
         WHERE role = 'student' AND class_id IN (${placeholders}) GROUP BY class_id`
      )
      .all(...classIds) as { class_id: number; c: number }[];
    for (const r of rows) studentCountByClass.set(r.class_id, r.c);
  }

  const assignmentCountByClass = new Map<number, number>();
  if (classIds.length) {
    const rows = db
      .prepare(
        `SELECT class_id, COUNT(*) AS c FROM assignments
         WHERE teacher_id = ? AND class_id IN (${placeholders}) GROUP BY class_id`
      )
      .all(user.id, ...classIds) as { class_id: number; c: number }[];
    for (const r of rows) assignmentCountByClass.set(r.class_id, r.c);
  }

  const firstName = user.name.split(" ")[0];

  const stats = [
    { icon: Layers, label: "Sinflarim", value: String(classes.length), accent: "text-violet-300" },
    { icon: Users, label: "O'quvchilar", value: String(studentCount), accent: "text-cyan-300" },
    { icon: FileText, label: "Topshiriqlar", value: String(assignmentCount), accent: "text-amber-300" },
    { icon: Gauge, label: "O'rtacha o'zlashtirish", value: `${avgMastery}%`, accent: "text-emerald-300" },
  ];

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <div className="relative z-10">
        <Header name={user.name} role="teacher" />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Xush kelibsiz, {firstName} ustoz! 👋
            </h1>
            <p className="mt-2 text-white/50">
              {WEEKDAYS_UZ[dow]} — bugungi darslaringiz va sinflaringiz holati.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell initialUnread={unread.c} />
            <Link
              href="/teacher/analytics"
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <Gauge className="h-4.5 w-4.5" />
              O&apos;zlashtirish
            </Link>
            <Link href="/teacher/create" className="btn-gradient px-5 py-3 text-sm">
              <Plus className="h-4.5 w-4.5" />
              Topshiriq yuborish
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, accent }) => (
            <div key={label} className="card relative overflow-hidden p-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
              <Icon className={`h-5 w-5 ${accent}`} />
              <p className="mt-3 font-display text-3xl font-bold text-white">{value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Bugungi darslar */}
          <div className="card p-7 lg:col-span-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                <CalendarDays className="h-4 w-4 text-violet-300" />
                Bugungi darslar
              </p>
              <span className="chip border-white/10 bg-white/5 text-white/50">{WEEKDAYS_UZ[dow]}</span>
            </div>
            <div className="mt-4 space-y-3">
              {todayLessons.length === 0 && (
                <p className="text-sm text-white/40">
                  {dow === 7
                    ? "Bugun yakshanba — darslar yo'q."
                    : "Bugun sizning darsingiz yo'q."}
                </p>
              )}
              {todayLessons.map((l: TeacherLesson) => (
                <div
                  key={l.timetableId}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex h-11 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
                    <Clock className="h-3.5 w-3.5 text-violet-300" />
                    <span className="text-[11px] font-semibold text-white/70">{l.startTime}</span>
                    <span className="text-[10px] text-white/40">{l.endTime}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {l.className} <span className="text-white/30">·</span>{" "}
                      <span className="text-white/60">{l.subjectName}</span>
                    </p>
                    <p className="text-xs text-white/40">{l.lessonNumber}-dars</p>
                  </div>
                  <Link
                    href={`/teacher/create?classId=${l.classId}`}
                    className="chip border-violet-400/30 bg-violet-500/10 text-violet-200 transition hover:bg-violet-500/20"
                  >
                    <Plus className="h-3 w-3" />
                    Topshiriq
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Fan kartasi */}
          <div className="card relative overflow-hidden p-7 lg:col-span-2">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
              <BookOpen className="h-4 w-4 text-cyan-300" />
              Fan
            </p>
            {subject ? (
              <>
                <p className="mt-4 font-display text-3xl font-bold text-white">{subject.name}</p>
                <p className="mt-2 text-sm text-white/50">
                  {classes.length} sinf · {studentCount} o&apos;quvchi
                </p>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    Dars jadvali (haftalik)
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    Haftada {allLessons.length} ta dars — {weeklyClassCount} sinfda{" "}
                    {subject.name} o&apos;tyapsiz.
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/40">
                Sizga hali fan biriktirilmagan. Administrator bilan bog&apos;laning.
              </p>
            )}
          </div>
        </div>

        {/* Mening sinflarim */}
        <div className="card mt-6 p-7">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
            <GraduationCap className="h-4 w-4 text-violet-300" />
            Mening sinflarim
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {classes.map((c: ClassRow) => {
              const next = formatNextLesson(
                findNextLesson(lessonsByClass.get(c.id) ?? [], dow),
                dow
              );
              return (
                <Link
                  key={c.id}
                  href={`/teacher/create?classId=${c.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
                >
                  <p className="font-display text-xl font-bold text-white">{c.name}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {studentCountByClass.get(c.id) ?? 0} o&apos;quvchi
                    {subject ? ` · ${subject.name}` : ""}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-cyan-300/80">
                    Keyingi dars: {next}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-white/40">
                    Topshiriqlar: {assignmentCountByClass.get(c.id) ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-violet-300/0 transition group-hover:text-violet-300">
                    Topshiriq yuborish →
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* So'nggi topshiriqlar */}
        <div className="card mt-6 p-7">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
            <FileText className="h-4 w-4 text-amber-300" />
            So&apos;nggi topshiriqlar
          </p>
          <div className="mt-4 space-y-3">
            {recent.length === 0 && (
              <p className="text-sm text-white/40">
                Hozircha topshiriq yo&apos;q. «Topshiriq yuborish» tugmasi bilan boshlang.
              </p>
            )}
            {recent.map((a) => {
              const progress =
                a.student_count > 0 ? Math.round((a.completed_count / a.student_count) * 100) : 0;
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{a.title}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {a.class_name ?? "—"} · {a.topic_name ?? "—"}
                        {a.deadline ? ` · muddat: ${a.deadline}` : ""}
                      </p>
                    </div>
                    <span
                      className={`chip ${
                        progress >= 80
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : progress > 0
                            ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                            : "border-white/10 bg-white/5 text-white/40"
                      }`}
                    >
                      {a.completed_count}/{a.student_count} bajarildi
                    </span>
                  </div>
                  {a.student_count > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
