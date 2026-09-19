import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Play,
  PencilLine,
  BrainCircuit,
  Trophy,
  Clock3,
  CalendarDays,
  FileText,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { parseJsonArray } from "@/lib/helpers";
import { getClassLessons, todayDow, WEEKDAYS_UZ } from "@/lib/teacher-context";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import MasteryRing from "@/components/MasteryRing";
import { StatusBadge, type AssignmentStatus } from "@/components/StatusBadge";
import type { AssignmentRow, ClassRow, ReportRow, SessionRow } from "@/types";

export const dynamic = "force-dynamic";

interface ClassAssignment extends AssignmentRow {
  subject_name: string | null;
  topic_name: string | null;
  teacher_name: string;
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Bugun";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/teacher");
  if (!user.profile_completed) redirect("/onboarding");

  const interests = parseJsonArray(user.interests, [] as string[]);
  const dow = todayDow();
  const firstName = user.name.split(" ")[0];

  const cls = user.class_id
    ? ((db.prepare("SELECT * FROM classes WHERE id = ?").get(user.class_id) as ClassRow | undefined) ?? null)
    : null;

  const todayLessons = cls ? getClassLessons(cls.id, dow) : [];

  const sessions = db.prepare("SELECT * FROM sessions WHERE student_id = ?").all(user.id) as SessionRow[];
  const sessionByAssignment = new Map<number, SessionRow>();
  for (const s of sessions) {
    if (!sessionByAssignment.has(s.assignment_id) || sessionByAssignment.get(s.assignment_id)!.id < s.id) {
      sessionByAssignment.set(s.assignment_id, s);
    }
  }

  // Only the student's own class — assignments from other classes never leak here
  const assignments = cls
    ? (db
        .prepare(
          `SELECT a.*, s.name AS subject_name, t.name AS topic_name, u.name AS teacher_name
           FROM assignments a
           JOIN users u ON u.id = a.teacher_id
           LEFT JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN topics t ON t.id = a.topic_id
           WHERE a.class_id = ?
           ORDER BY (a.deadline IS NULL), a.deadline, a.id DESC`
        )
        .all(cls.id) as ClassAssignment[])
    : [];

  // subject → first not-yet-completed assignment (links today's lessons to homework)
  const openBySubject = new Map<number, ClassAssignment>();
  for (const a of assignments) {
    if (a.subject_id == null) continue;
    if (sessionByAssignment.get(a.id)?.status === "completed") continue;
    if (!openBySubject.has(a.subject_id)) openBySubject.set(a.subject_id, a);
  }

  const latestReport = db
    .prepare("SELECT * FROM reports WHERE student_id = ? ORDER BY id DESC LIMIT 1")
    .get(user.id) as ReportRow | undefined;

  function statusInfo(a: ClassAssignment): {
    status: AssignmentStatus;
    action: string;
    icon: typeof Play;
  } {
    const st = sessionByAssignment.get(a.id)?.status;
    if (!st) {
      return { status: "not_started", action: "Boshlash", icon: Play };
    }
    if (st === "active") {
      return { status: "in_progress", action: "Davom ettirish", icon: Clock3 };
    }
    return { status: "completed", action: "To'liq ko'rish", icon: FileText };
  }

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={user.name} role="student" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <div className="mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Salom, {firstName}! 👋
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {cls ? (
              <span className="chip border-violet-400/30 bg-violet-500/10 text-base font-semibold text-violet-200">
                <GraduationCap className="h-4 w-4" />
                {cls.name} sinfi | O&apos;quvchi
              </span>
            ) : (
              <span className="chip border-white/10 bg-white/5 text-white/50">Sinf biriktirilmagan</span>
            )}
            <p className="text-sm text-white/50">{WEEKDAYS_UZ[dow]} — bugungi kun tartibi va topshiriqlaringiz.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-5">
          {/* Bugungi darslar */}
          <div className="card p-7 lg:col-span-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                <CalendarDays className="h-4 w-4 text-violet-300" />
                Bugungi darslaringiz
              </p>
              {cls && <span className="chip border-white/10 bg-white/5 text-white/50">{cls.name}</span>}
            </div>
            <div className="mt-4 space-y-3">
              {todayLessons.length === 0 && (
                <p className="text-sm text-white/40">
                  {dow === 7
                    ? "Bugun yakshanba — darslar yo'q."
                    : "Bugun sening darsingiz yo'q."}
                </p>
              )}
              {todayLessons.map((l) => {
                const linked = l.subjectId != null ? openBySubject.get(l.subjectId) : undefined;
                const body = (
                  <>
                    <div className="flex h-11 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
                      <span className="text-[11px] font-semibold text-white/70">{l.startTime}</span>
                      <span className="text-[10px] text-white/40">{l.endTime}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">
                        {l.lessonNumber}-dars <span className="text-white/30">·</span>{" "}
                        <span className="text-white/80">{l.subjectName}</span>
                      </p>
                      <p className="text-xs text-white/40">
                        {l.teacherName ? `${l.teacherName} ustoz` : "O'qituvchi aniqlanmagan"}
                      </p>
                    </div>
                    {linked && (
                      <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                        Topshiriq mavjud
                      </span>
                    )}
                  </>
                );
                const cardCls =
                  "flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4";
                return linked ? (
                  <Link
                    key={l.timetableId}
                    href={`/student/assignment?assignmentId=${linked.id}`}
                    className={`${cardCls} transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={l.timetableId} className={cardCls}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI profil */}
          <div className="card p-7 lg:col-span-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold uppercase tracking-wider text-white/40">
                Mening AI o&apos;quv profilim
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-white">{user.name}</h2>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/30">
              Qiziqishlari
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {interests.map((i) => (
                <span key={i} className="chip border-white/10 bg-white/5 text-white/80">
                  {i}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/30">
              O&apos;rganish usuli
            </p>
            <span className="chip mt-2 border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              {user.learning_style || "Viktorina"}
            </span>
            <Link
              href="/onboarding"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200"
            >
              <PencilLine className="h-4 w-4" />
              Profilni tahrirlash
            </Link>
          </div>
        </div>

        {/* Bugungi topshiriqlar */}
        <div className="card mt-5 p-7">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
              <FileText className="h-4 w-4 text-amber-300" />
              Bugungi topshiriqlar
            </p>
            {assignments.length > 0 && (
              <span className="chip border-white/10 bg-white/5 text-white/50">{assignments.length} ta</span>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {assignments.length === 0 && (
              <p className="text-sm text-white/40">
                Bugun bajarilishi kerak bo&apos;lgan yangi topshiriq yo&apos;q.
              </p>
            )}
            {assignments.map((a) => {
              const { status, action, icon: ActionIcon } = statusInfo(a);
              const dl = formatDeadline(a.deadline);
              return (
                <Link
                  key={a.id}
                  href={`/student/assignment?assignmentId=${a.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/40">
                        {a.subject_name ?? "—"} <span className="text-white/20">·</span>{" "}
                        {a.topic_name ?? "—"} <span className="text-white/20">·</span>{" "}
                        {a.teacher_name} ustoz
                      </p>
                      <p className="mt-0.5 font-semibold text-white">{a.title}</p>
                      {dl && <p className="mt-0.5 text-xs text-white/40">Muddat: {dl}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="chip border-violet-400/30 bg-violet-500/10 text-violet-200">
                        <ActionIcon className="h-3.5 w-3.5" />
                        {action}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Oxirgi natija */}
        {latestReport && (
          <div className="card mt-5 p-7">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <MasteryRing value={Math.round(latestReport.mastery)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-white/40">
                    Oxirgi natija · {latestReport.assignment_title}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {parseJsonArray(latestReport.strengths, [] as string[]).map((s) => (
                    <span key={s} className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                      {s}
                    </span>
                  ))}
                  {parseJsonArray(latestReport.weaknesses, [] as string[]).map((s) => (
                    <span key={s} className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-white/50">
                  {latestReport.feedback}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
