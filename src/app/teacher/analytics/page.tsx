import { redirect } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  ChevronRight,
  Users,
  BookOpen,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getTeacherClasses, getTeacherSubject } from "@/lib/teacher-context";
import { getClassAnalytics } from "@/lib/analytics";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import MasteryRing from "@/components/MasteryRing";
import type { ClassRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function TeacherAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/student");

  const params = await searchParams;
  const classes = getTeacherClasses(user.id);
  const subject = getTeacherSubject(user.id);

  const requested = Number(params.classId);
  const selected =
    (Number.isInteger(requested) && classes.find((c: ClassRow) => c.id === requested)) ||
    classes[0] ||
    null;

  const analytics = selected ? getClassAnalytics(user.id, selected.id) : null;

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={user.name} role="teacher" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 sm:px-10">
        <div className="mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            O&apos;zlashtirish tahlili
          </h1>
          <p className="mt-2 text-white/50">
            Sinf → o&apos;quvchi → individual hisobot. Barcha ma&apos;lumotlar real sessiyalar natijalaridan.
          </p>
        </div>

        {/* Class selector */}
        <div className="mt-6 flex flex-wrap gap-2">
          {classes.map((c: ClassRow) => (
            <Link
              key={c.id}
              href={`/teacher/analytics?classId=${c.id}`}
              className={`chip ${
                selected?.id === c.id
                  ? "border-violet-400/50 bg-violet-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              {c.name}
            </Link>
          ))}
        </div>

        {!analytics && (
          <div className="card mt-6 p-7">
            <p className="text-sm text-white/40">Sinf topilmadi.</p>
          </div>
        )}

        {analytics && selected && (
          <>
            {/* A. Overall stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="card flex items-center gap-5 p-6">
                <MasteryRing value={analytics.avgMastery} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    O&apos;rtacha o&apos;zlashtirish
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    {selected.name} · {subject?.name ?? "—"}
                  </p>
                </div>
              </div>
              <div className="card relative overflow-hidden p-6">
                <ClipboardCheck className="h-5 w-5 text-cyan-300" />
                <p className="mt-3 font-display text-3xl font-bold text-white">
                  {analytics.completionRate}%
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">
                  Bajarilish darajasi
                </p>
              </div>
              <div className="card relative overflow-hidden p-6">
                <Users className="h-5 w-5 text-emerald-300" />
                <p className="mt-3 font-display text-3xl font-bold text-white">
                  {analytics.students.length}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">
                  O&apos;quvchi
                </p>
              </div>
            </div>

            {/* Attention list */}
            <div className="card mt-6 p-7">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  Diqqat talab qiladigan o&apos;quvchilar
                </p>
                <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                  {analytics.attention.length} ta
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {analytics.attention.length === 0 && (
                  <p className="text-sm text-white/40">
                    Hozircha diqqat talab qiladigan o&apos;quvchi yo&apos;q — ajoyib!
                  </p>
                )}
                {analytics.attention.map((s) => (
                  <Link
                    key={s.id}
                    href={`/teacher/analytics/student?studentId=${s.id}&classId=${selected.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-4 transition hover:border-amber-400/40"
                  >
                    <div>
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-white/40">
                        {s.completedCount}/{s.assignmentCount} topshiriq bajarilgan
                        {s.inProgressCount > 0 ? ` · ${s.inProgressCount} davom etmoqda` : ""}
                      </p>
                    </div>
                    <span
                      className={`chip ${
                        s.avgMastery === null
                          ? "border-red-400/30 bg-red-500/10 text-red-200"
                          : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {s.avgMastery === null ? "Boshlanmagan" : `${s.avgMastery}%`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Class topics + common mistakes */}
            {analytics.topics.length > 0 && (
              <div className="card mt-6 p-7">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                  <BookOpen className="h-4 w-4 text-emerald-300" />
                  Mavzular bo&apos;yicha sinf ko&apos;rsatkichi
                </p>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    {analytics.topics.map((t) => (
                      <div key={t.topic}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/70">{t.topic}</span>
                          <span className="text-white/40">{t.avgMastery}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${
                              t.avgMastery >= 80
                                ? "bg-emerald-400"
                                : t.avgMastery >= 60
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                            }`}
                            style={{ width: `${t.avgMastery}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/30">
                      Ko&apos;p uchraydigan xatolar
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analytics.commonMistakes.length === 0 && (
                        <p className="text-sm text-white/40">Sezilarli xato patterni yo&apos;q.</p>
                      )}
                      {analytics.commonMistakes.map((m) => (
                        <span
                          key={m.text}
                          className="chip border-red-400/25 bg-red-500/10 text-red-200"
                        >
                          {m.text} · {m.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Student list */}
            <div className="card mt-6 p-7">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
                <TrendingUp className="h-4 w-4 text-violet-300" />
                {selected.name} o&apos;quvchilari
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/30">
                      <th className="pb-3 pr-4 font-medium">O&apos;quvchi</th>
                      <th className="pb-3 pr-4 font-medium">Bajarilgan</th>
                      <th className="pb-3 pr-4 font-medium">O&apos;zlashtirish</th>
                      <th className="pb-3 pr-4 font-medium">Holat</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.students.map((s) => (
                      <tr key={s.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white">{s.name}</p>
                          <p className="text-xs text-white/30">{s.learning_style || "—"}</p>
                        </td>
                        <td className="py-3 pr-4 text-white/60">
                          {s.completedCount}/{s.assignmentCount}
                        </td>
                        <td className="py-3 pr-4">
                          {s.avgMastery === null ? (
                            <span className="text-white/30">—</span>
                          ) : (
                            <span
                              className={`font-semibold ${
                                s.avgMastery >= 80
                                  ? "text-emerald-300"
                                  : s.avgMastery >= 60
                                    ? "text-amber-300"
                                    : "text-red-300"
                              }`}
                            >
                              {s.avgMastery}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {s.inProgressCount > 0 ? (
                            <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                              Davom etmoqda
                            </span>
                          ) : s.completedCount === 0 ? (
                            <span className="chip border-red-400/30 bg-red-500/10 text-red-200">
                              Bajarilmagan
                            </span>
                          ) : (
                            <span className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                              Bajarilgan
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/teacher/analytics/student?studentId=${s.id}&classId=${selected.id}`}
                            className="chip border-violet-400/30 bg-violet-500/10 text-violet-200 transition hover:bg-violet-500/20"
                          >
                            Hisobot
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
