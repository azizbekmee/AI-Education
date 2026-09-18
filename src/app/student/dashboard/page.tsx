import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, Play, PencilLine, Target, BrainCircuit, Trophy, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { parseJsonArray } from "@/lib/helpers";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import MasteryRing from "@/components/MasteryRing";
import type { AssignmentRow, ReportRow, SessionRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/teacher");
  if (!user.profile_completed) redirect("/onboarding");

  const interests = parseJsonArray(user.interests, [] as string[]);
  const assignments = db.prepare("SELECT * FROM assignments ORDER BY id DESC").all() as AssignmentRow[];
  const sessions = db.prepare("SELECT * FROM sessions WHERE student_id = ?").all(user.id) as SessionRow[];
  const latestReport = db.prepare("SELECT * FROM reports WHERE student_id = ? ORDER BY id DESC LIMIT 1").get(user.id) as ReportRow | undefined;

  const sessionByAssignment = new Map<number, SessionRow>();
  for (const s of sessions) {
    if (!sessionByAssignment.has(s.assignment_id) || sessionByAssignment.get(s.assignment_id)!.id < s.id) {
      sessionByAssignment.set(s.assignment_id, s);
    }
  }

  const today = assignments[0];
  const todaySession = today ? sessionByAssignment.get(today.id) : undefined;

  function sessionLabel(status: SessionRow["status"] | undefined) {
    if (!status) return { text: "Boshlash", icon: Play };
    if (status === "active") return { text: "Davom ettirish", icon: Clock3 };
    return { text: "Qayta bajarish", icon: Play };
  }

  const { text: btnText, icon: BtnIcon } = sessionLabel(todaySession?.status);

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={user.name} role="student" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <div className="mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Salom, {user.name}!
          </h1>
          <p className="mt-2 text-white/50">
            AI ustozing bugun senga maxsus topshiriq tayyorladi.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-5">
          {/* Bugungi topshiriq */}
          <div className="card relative overflow-hidden p-7 lg:col-span-3">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-300" />
                <span className="text-sm font-semibold uppercase tracking-wider text-white/40">
                  Bugungi topshiriq
                </span>
              </div>

              {today ? (
                <>
                  <h2 className="mt-3 font-display text-2xl font-bold text-white">{today.title}</h2>
                  <span className="chip mt-3 border-violet-400/30 bg-violet-500/10 text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Bu topshiriq senga moslashtirildi
                  </span>
                  <div className="mt-6 flex items-center gap-4">
                    <Link href={`/student/assignment?assignmentId=${today.id}`} className="btn-gradient">
                      <BtnIcon className="h-4.5 w-4.5" />
                      {btnText}
                    </Link>
                    {todaySession?.status === "completed" && (
                      <span className="text-sm text-white/50">
                        O&apos;zlashtirish: <b className="text-cyan-300">{Math.round(todaySession.mastery)}%</b>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-white/40">
                  Hozircha topshiriq yo&apos;q. O&apos;qituvching yangi topshiriq yaratishi kutilmoqda.
                </p>
              )}
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

        {/* Boshqa topshiriqlar */}
        {assignments.length > 1 && (
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
              Boshqa topshiriqlar
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {assignments.slice(1).map((a) => {
                const s = sessionByAssignment.get(a.id);
                return (
                  <Link
                    key={a.id}
                    href={`/student/assignment?assignmentId=${a.id}`}
                    className="card group flex items-center justify-between p-5 transition hover:border-white/20"
                  >
                    <div>
                      <p className="font-semibold text-white group-hover:text-violet-200">{a.title}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {s?.status === "completed" ? `Yakunlangan · ${Math.round(s.mastery)}%` : s ? "Davom etmoqda" : "Boshlanmagan"}
                      </p>
                    </div>
                    <Play className="h-4 w-4 text-white/30 transition group-hover:text-violet-300" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
