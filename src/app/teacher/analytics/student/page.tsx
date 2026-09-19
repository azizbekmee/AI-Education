import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Lightbulb,
  TrendingUp,
  BookOpen,
  Flame,
  Activity,
  Sparkles,
  Target,
  MessagesSquare,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getStudentAnalytics } from "@/lib/analytics";
import { getTeacherSubject } from "@/lib/teacher-context";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import MasteryRing from "@/components/MasteryRing";

export const dynamic = "force-dynamic";

function Section({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: typeof Brain;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-7">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/40">
        <Icon className={`h-4 w-4 ${accent}`} />
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default async function StudentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/student");

  const params = await searchParams;
  const studentId = Number(params.studentId);
  if (!Number.isInteger(studentId)) redirect("/teacher/analytics");

  const data = getStudentAnalytics(user.id, studentId);
  if (!data) redirect("/teacher/analytics");

  const subject = getTeacherSubject(user.id);
  const { student, reports, avgMastery, dynamics, topicBreakdown, strengths, weaknesses, engagement, aiInsight } = data;

  const maxDyn = Math.max(100, ...dynamics.map((d) => d.mastery));

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={user.name} role="teacher" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <Link
          href="/teacher/analytics"
          className="mt-4 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          O&apos;zlashtirish tahliliga qaytish
        </Link>

        {/* Header */}
        <div className="card mt-4 flex flex-wrap items-center gap-6 p-7">
          <MasteryRing value={avgMastery} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{student.name}</h1>
            <p className="mt-1 text-sm text-white/50">
              {student.className} · {subject?.name ?? "—"} · {student.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                {student.learningStyle}
              </span>
              {student.interests.map((i) => (
                <span key={i} className="chip border-white/10 bg-white/5 text-white/60">
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* A. Umumiy ko'rsatkichlar */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "O'rtacha o'zlashtirish", value: `${avgMastery}%` },
            { label: "Yakunlangan sessiyalar", value: `${engagement.completed}/${engagement.sessionsTotal}` },
            { label: "O'rtacha urinish", value: String(engagement.avgAttempts) },
            { label: "O'rtacha hint", value: String(engagement.avgHintsUsed) },
          ].map((s) => (
            <div key={s.label} className="card p-5">
              <p className="font-display text-2xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">{s.label}</p>
            </div>
          ))}
        </div>

        {/* B. Kuchli tomonlar */}
        <Section icon={Sparkles} title="Kuchli tomonlari" accent="text-emerald-300">
          {strengths.length === 0 ? (
            <p className="text-sm text-white/40">Hozircha ma&apos;lumot yo&apos;q.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {strengths.map((s) => (
                <span key={s} className="chip border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                  {s}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* C. Rivojlanish sohalari */}
        <Section icon={Target} title="Rivojlanish sohalari" accent="text-amber-300">
          {weaknesses.length === 0 ? (
            <p className="text-sm text-white/40">Aniqlangan zaiflik yo&apos;q — yaxshi natija!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {weaknesses.map((s) => (
                <span key={s} className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">
                  {s}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* D. Mavzu bo'yicha tahlil */}
        <Section icon={BookOpen} title="Mavzular bo'yicha tahlil" accent="text-violet-300">
          {topicBreakdown.length === 0 ? (
            <p className="text-sm text-white/40">Hozircha mavzu ma&apos;lumotlari yo&apos;q.</p>
          ) : (
            <div className="space-y-3">
              {topicBreakdown.map((t) => (
                <div key={t.topic}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{t.topic}</span>
                    <span
                      className={`font-semibold ${
                        t.mastery >= 80 ? "text-emerald-300" : t.mastery >= 60 ? "text-amber-300" : "text-red-300"
                      }`}
                    >
                      {t.mastery}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        t.mastery >= 80
                          ? "bg-emerald-400"
                          : t.mastery >= 60
                            ? "bg-amber-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${t.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* E. Xato tahlili + engagement */}
        <Section icon={Flame} title="Faollik va xato tahlili" accent="text-orange-300">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-xl font-bold text-white">{engagement.avgAttempts}</p>
              <p className="mt-1 text-xs text-white/40">Har bir qadamda o&apos;rtacha urinish</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-xl font-bold text-white">{engagement.avgHintsUsed}</p>
              <p className="mt-1 text-xs text-white/40">Har bir sessiyada o&apos;rtacha hint</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-xl font-bold text-white">{engagement.practiceSolved}</p>
              <p className="mt-1 text-xs text-white/40">Qo&apos;shimcha mashqlar yechildi</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/50">
            {engagement.avgHintsUsed >= 3
              ? "Ko'p yordam so'raydi — asosiy tushunchalarni mustahkamlash kerak."
              : engagement.avgAttempts >= 2
                ? "Bir necha urinishdan keyin to'g'ri javobga keladi — mashq davom etishi kerak."
                : "Mustaqil ishlashi yuqori — yangi, murakkabroq topshiriqlar tavsiya etiladi."}
          </p>
        </Section>

        {/* F. Progress dinamikasi */}
        <Section icon={TrendingUp} title="Progress dinamikasi" accent="text-cyan-300">
          {dynamics.length === 0 ? (
            <p className="text-sm text-white/40">Hozircha yakunlangan sessiya yo&apos;q.</p>
          ) : (
            <div className="flex h-40 items-end gap-4">
              {dynamics.map((d, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-white/70">{d.mastery}%</span>
                  <div
                    className={`w-full max-w-16 rounded-t-lg ${
                      i === 0 ? "bg-cyan-400/60" : i === dynamics.length - 1 ? "bg-cyan-300" : "bg-cyan-400/80"
                    }`}
                    style={{ height: `${Math.max(8, (d.mastery / maxDyn) * 100)}%` }}
                  />
                  <span className="line-clamp-2 text-center text-[10px] text-white/40">{d.label}</span>
                </div>
              ))}
            </div>
          )}
          {dynamics.length >= 2 && (
            <p className="mt-3 text-sm text-white/50">
              {dynamics[dynamics.length - 1].mastery > dynamics[0].mastery
                ? "Dinamika ijobiy — oldingi natijadan yuqori."
                : dynamics[dynamics.length - 1].mastery === dynamics[0].mastery
                  ? "Natija barqaror."
                  : "Oxirgi natija pastroq — qo'shimcha takrorlash tavsiya etiladi."}
            </p>
          )}
        </Section>

        {/* G. O'quv uslubi */}
        <Section icon={Brain} title="O'quv uslubi" accent="text-fuchsia-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200">
              {student.learningStyle}
            </span>
            <span className="text-sm text-white/50">
              AI topshiriqni shu uslub va qiziqishlar asosida shaxsiylashtiradi.
            </span>
          </div>
        </Section>

        {/* H. AI insight */}
        <Section icon={Lightbulb} title="AI xulosa (o'qituvchi uchun)" accent="text-amber-300">
          {aiInsight ? (
            <p className="text-sm leading-relaxed text-white/70">{aiInsight}</p>
          ) : (
            <p className="text-sm text-white/40">
              Hozircha AI xulosa yo&apos;q — o&apos;quvchi sessiyani yakunlagach shakllanadi.
            </p>
          )}
        </Section>

        {/* Individual reports */}
        <Section icon={MessagesSquare} title="Yakuniy hisobotlar" accent="text-white/40">
          {reports.length === 0 ? (
            <p className="text-sm text-white/40">Hozircha hisobot yo&apos;q.</p>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{r.assignmentTitle}</p>
                    <span
                      className={`chip ${
                        r.mastery >= 80
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : r.mastery >= 60
                            ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                            : "border-red-400/30 bg-red-500/10 text-red-200"
                      }`}
                    >
                      {r.mastery}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{r.feedback}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="mt-6 flex items-center gap-2 text-xs text-white/30">
          <Activity className="h-3.5 w-3.5" />
          Barcha ko&apos;rsatkichlar real sessiya va hisobot ma&apos;lumotlaridan hisoblangan.
        </div>
      </main>
    </div>
  );
}
