import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateReport } from "@/lib/ai/personalization/engine";
import { computeMastery } from "@/lib/ai/personalization/fallback";
import { parseJsonArray } from "@/lib/helpers";
import type { AssignmentRow, Experience, SessionRow, SessionSummary, StudentProfile } from "@/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { sessionId?: number } | null;
  const sessionId = Number(body?.sessionId);
  if (!Number.isInteger(sessionId)) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }

  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  if (!session || session.student_id !== user.id) {
    return NextResponse.json({ error: "Sessiya topilmadi." }, { status: 404 });
  }
  if (session.status === "completed") {
    return NextResponse.json({ error: "Sessiya allaqachon yakunlangan." }, { status: 400 });
  }

  const experience = parseJsonArray<Experience>(session.questions, [])[0];
  if (!experience) return NextResponse.json({ error: "Tajriba topilmadi." }, { status: 404 });

  const results = parseJsonArray<{
    attempts: number;
    solved: boolean;
    done: boolean;
    routes?: string[];
    hintsUsed?: number;
    practiceDone?: number;
  }>(session.results, []);
  const summaries: SessionSummary[] = experience.activities.map((a, i) => {
    const r = results[i] ?? { attempts: 1, solved: false, done: true, routes: [] };
    return {
      concept: a.concept,
      kind: a.kind,
      attempts: r.attempts || 1,
      solved: r.solved,
      hintsUsed: r.hintsUsed ?? 0,
      practiceDone: r.practiceDone ?? 0,
      routes: r.routes ?? [],
    };
  });

  const mastery = computeMastery(results);

  const profile: StudentProfile = {
    name: user.name,
    interests: parseJsonArray(user.interests, [] as string[]),
    learningStyle: user.learning_style || "",
  };

  const report = await generateReport({
    profile,
    assignmentTitle: (db.prepare("SELECT title FROM assignments WHERE id = ?").get(session.assignment_id) as { title: string })?.title ?? "",
    todayInterest: session.today_interest ?? "",
    experienceTitle: experience.title,
    experienceTypeLabel: experience.typeLabel,
    summaries,
    mastery,
  });

  db.prepare(
    "UPDATE sessions SET status = 'completed', mastery = ?, finished_at = datetime('now') WHERE id = ?"
  ).run(mastery, sessionId);

  const assignment = db
    .prepare("SELECT * FROM assignments WHERE id = ?")
    .get(session.assignment_id) as AssignmentRow | undefined;

  const reportId = db
    .prepare(
      `INSERT INTO reports (session_id, student_id, assignment_id, assignment_title, mastery, strengths, weaknesses, feedback, insight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      user.id,
      session.assignment_id,
      assignment?.title ?? "",
      mastery,
      JSON.stringify(report.strengths),
      JSON.stringify(report.weaknesses),
      report.feedback,
      report.insight
    ).lastInsertRowid as number;

  if (assignment?.teacher_id) {
    db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)").run(
      assignment.teacher_id,
      "Yangi o'quv hisoboti mavjud",
      `${user.name} «${assignment.title}» topshiriqni yakunladi. O'zlashtirish: ${mastery}%.`
    );
  }

  return NextResponse.json({ report: { ...report, id: reportId } });
}
