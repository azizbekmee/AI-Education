import { redirect } from "next/navigation";
import { BookOpen, Info } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import {
  getTeacherClasses,
  getTeacherLessons,
  getTeacherSubject,
  getTeacherTopics,
  todayDow,
} from "@/lib/teacher-context";
import Header from "@/components/Header";
import Backdrop from "@/components/Backdrop";
import AssignmentWizard from "@/components/teacher/AssignmentWizard";

export const dynamic = "force-dynamic";

export default async function CreateAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/student");

  const subject = getTeacherSubject(user.id);
  const classes = getTeacherClasses(user.id);
  const topics = getTeacherTopics(user.id);
  const todayClassIds = [
    ...new Set(getTeacherLessons(user.id, todayDow()).map((l) => l.classId)),
  ];
  const sp = await searchParams;
  const initialClassId = Number(sp.classId) || null;

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <Header name={user.name} role="teacher" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 sm:px-10">
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-white">
          Topshiriq yuborish
        </h1>
        <p className="mt-2 text-white/50">
          Sinf va mavzuni tanlang, topshiriq fayllarini yuklang — AI o&apos;quvchilarga aynan
          sizning topshiriqingiz asosida yordam beradi.
        </p>

        {!subject ? (
          <div className="card mt-8 flex items-start gap-3 p-6">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-sm text-white/60">
              Sizga hali fan biriktirilmagan. Topshiriq yuborish uchun administrator bilan
              bog&apos;laning.
            </p>
          </div>
        ) : classes.length === 0 || topics.length === 0 ? (
          <div className="card mt-8 flex items-start gap-3 p-6">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-sm text-white/60">
              Sizga biriktirilgan sinf yoki mavzu topilmadi. Administrator bilan bog&apos;laning.
            </p>
          </div>
        ) : (
          <>
            <div className="chip mt-4 border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              <BookOpen className="h-3.5 w-3.5" />
              Fan: {subject.name}
            </div>
            <AssignmentWizard
              classes={classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade }))}
              topics={topics.map((t) => ({ id: t.id, name: t.name, grade: t.grade }))}
              subjectName={subject.name}
              todayClassIds={todayClassIds}
              initialClassId={initialClassId}
            />
          </>
        )}
      </div>
    </div>
  );
}
