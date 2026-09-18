import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FileText,
  Gauge,
  Sparkles,
  Plus,
  BrainCircuit,
  Trophy,
  Lightbulb,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { parseJsonArray } from "@/lib/helpers";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import MasteryRing from "@/components/MasteryRing";
import NotificationsBell from "@/components/NotificationsBell";
import type { AssignmentRow, ReportRow, SessionRow, UserRow } from "@/types";

export default async function TeacherDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/student");

  const students = db.prepare("SELECT * FROM users WHERE role = 'student'").all() as UserRow[];
  const assignments = db.prepare("SELECT * FROM assignments ORDER BY id DESC").all() as AssignmentRow[];
  const reports = db
    .prepare(
      `SELECT r.*, u.name AS student_name FROM reports r
       JOIN users u ON u.id = r.student_id ORDER BY r.id DESC LIMIT 10`
    )
    .all() as (ReportRow & { student_name: string })[];
  const sessions = db.prepare("SELECT * FROM sessions WHERE status = 'active'").all() as SessionRow[];
  const unread = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };

  const avgMastery =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.mastery, 0) / reports.length)
      : 0;

  const mainStudent = students[0];
  const mainReport = reports.find((r) => mainStudent && r.student_id === mainStudent.id);
  const mainInterests = mainStudent ? parseJsonArray(mainStudent.interests, [] as string[]) : [];

  const reportByAssignment = new Map<number, (typeof reports)[number]>();
  for (const r of reports) {
    if (!reportByAssignment.has(r.assignment_id)) reportByAssignment.set(r.assignment_id, r);
  }

  const stats = [
    { icon: Users, label: "Faol o'quvchilar", value: String(students.length), accent: "text-violet-300" },
    { icon: FileText, label: "Topshiriqlar", value: String(assignments.length), accent: "text-cyan-300" },
    { icon: Gauge, label: "O'rtacha o'zlashtirish", value: `${avgMastery}%`, accent: "text-emerald-300" },
    { icon: Sparkles, label: "Yangi hisobotlar", value: String(unread.c), accent: "text-amber-300" },
  ];

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <div className="relative z-10">
        <Header name={user.name} role="teacher" />
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Xush kelibsiz, {user.name}!
            </h1>
            <p className="mt-2 text-white/50">
              Sinfingizning AI o&apos;quv jarayoni — bir qarashda.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell initialUnread={unread.c} />
            <Link href="/teacher/create" className="btn-gradient px-5 py-3 text-sm">
              <Plus className="h-4.5 w-4.5" />
              Yangi topshiriq
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, accent }, i) => (
            <div key={label} className="card relative overflow-hidden p-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
              <Icon className={`h-5 w-5 ${accent}`} />
              <p className="mt-3 font-display text-3xl font-bold text-white">{value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">{label}</p>
              <span className="absolute right-3 top-3 text-[10px] text-white/20">#{i + 1}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Alex report card */}
          {mainStudent && mainReport && (
            <div className="card relative overflow-hidden p-7 lg:col-span-3">
              <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-violet-300" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-white/40">
                    O&apos;quvchi hisoboti
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
                  <MasteryRing value={Math.round(mainReport.mastery)} label="O'zlashtirish" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-bold text-white">
                      {mainReport.student_name}
                    </p>
                    <p className="text-sm text-white/40">{mainReport.assignment_title}</p>

                    <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      <Trophy className="h-3.5 w-3.5" />
                      Kuchli tomonlari
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {parseJsonArray(mainReport.strengths, [] as string[]).map((s) => (
                        <span key={s} className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                          {s}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Rivojlanishi kerak
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {parseJsonArray(mainReport.weaknesses, [] as string[]).map((s) => (
                        <span key={s} className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/60">
                  {mainReport.feedback}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="chip border-white/10 bg-white/5 text-white/60">
                    O&apos;rganish usuli: {mainStudent.learning_style || "—"}
                  </span>
                  {mainInterests.map((i) => (
                    <span key={i} className="chip border-white/10 bg-white/5 text-white/60">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Assignments list */}
          <div className="card p-7 lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
              Topshiriqlar
            </p>
            <div className="mt-4 space-y-3">
              {assignments.length === 0 && (
                <p className="text-sm text-white/40">Hozircha topshiriq yo&apos;q.</p>
              )}
              {assignments.map((a) => {
                const rep = reportByAssignment.get(a.id);
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{a.title}</p>
                      {rep ? (
                        <span className="chip border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                          {Math.round(rep.mastery)}%
                        </span>
                      ) : (
                        <span className="chip border-white/10 bg-white/5 text-white/40">
                          Kutilmoqda
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                      {rep ? `${rep.student_name} natijasi` : "O'quvchi hali boshlamagan"}
                    </p>
                  </div>
                );
              })}
            </div>
            {sessions.length > 0 && (
              <p className="mt-4 text-xs text-white/30">
                {sessions.length} ta faol o&apos;quv sessiyasi davom etmoqda.
              </p>
            )}
          </div>
        </div>

        {/* All reports */}
        {reports.length > 0 && (
          <div className="card mt-6 p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
              So&apos;nggi o&apos;quv natijalari
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-white/30">
                    <th className="pb-3 pr-4 font-medium">O&apos;quvchi</th>
                    <th className="pb-3 pr-4 font-medium">Topshiriq</th>
                    <th className="pb-3 pr-4 font-medium">O&apos;zlashtirish</th>
                    <th className="pb-3 font-medium">Kuchli tomoni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reports.map((r) => (
                    <tr key={r.id} className="text-white/70">
                      <td className="py-3 pr-4 font-semibold text-white">{r.student_name}</td>
                      <td className="py-3 pr-4">{r.assignment_title}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`chip ${
                            r.mastery >= 70
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                              : r.mastery >= 40
                                ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                : "border-red-400/30 bg-red-500/10 text-red-200"
                          }`}
                        >
                          {Math.round(r.mastery)}%
                        </span>
                      </td>
                      <td className="py-3 text-white/50">
                        {parseJsonArray(r.strengths, [] as string[])[0] ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
