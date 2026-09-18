import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateReport } from "@/lib/ai/claude";
import { computeMastery, fallbackReport } from "@/lib/ai/fallback";
import { parseJsonArray } from "@/lib/helpers";
import type { AssignmentRow, Question, QuestionResult, SessionRow, SessionSummary } from "@/types";

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

  const questions = parseJsonArray<Question>(session.questions, []);
  const results = parseJsonArray<QuestionResult>(session.results, []);

  const summaries: SessionSummary[] = questions.map((q, i) => {
    const r = results[i] ?? { attempts: 1, solved: false, done: true };
    return {
      questionText: q.text,
      chosenText: "",
      correctText: q.options[q.correctIndex],
      concept: q.concept,
      attempts: r.attempts || 1,
      solved: r.solved,
    };
  });

  const mastery = computeMastery(results);

  let report;
  try {
    report = await generateReport(
      { name: user.name, interests: parseJsonArray(user.interests, [] as string[]), learningStyle: user.learning_style || "Viktorina" },
      (db.prepare("SELECT title FROM assignments WHERE id = ?").get(session.assignment_id) as { title: string }).title,
      summaries,
      mastery
    );
  } catch {
    report = fallbackReport(summaries);
  }

  db.prepare(
    "UPDATE sessions SET status = 'completed', mastery = ?, finished_at = datetime('now') WHERE id = ?"
  ).run(mastery, sessionId);

  const assignment = db
    .prepare("SELECT * FROM assignments WHERE id = ?")
    .get(session.assignment_id) as AssignmentRow | undefined;

  const reportId = db
    .prepare(
      `INSERT INTO reports (session_id, student_id, assignment_id, assignment_title, mastery, strengths, weaknesses, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      user.id,
      session.assignment_id,
      assignment?.title ?? "",
      mastery,
      JSON.stringify(report.strengths),
      JSON.stringify(report.weaknesses),
      report.feedback
    ).lastInsertRowid as number;

  const teacherId = assignment?.teacher_id;
  if (teacherId) {
    db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)").run(
      teacherId,
      "Yangi o'quv hisoboti mavjud",
      `${user.name} «${assignment?.title ?? ""}» topshiriqni yakunladi. O'zlashtirish: ${mastery}%.`
    );
  }

  return NextResponse.json({ report: { ...report, id: reportId } });
}
