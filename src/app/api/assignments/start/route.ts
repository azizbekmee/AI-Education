import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { safeGenerateQuestions } from "@/lib/ai/claude";
import { fallbackQuestions } from "@/lib/ai/fallback";
import { validateQuestions } from "@/lib/ai/gemini";
import { parseJsonArray, toSafeAll } from "@/lib/helpers";
import type { AssignmentRow, Question, QuestionResult, StudentProfile } from "@/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Bu amal faqat o'quvchilar uchun." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { assignmentId?: number } | null;
  const assignmentId = Number(body?.assignmentId);
  if (!Number.isInteger(assignmentId)) {
    return NextResponse.json({ error: "Topshiriq tanlanmagan." }, { status: 400 });
  }

  const assignment = db
    .prepare("SELECT * FROM assignments WHERE id = ?")
    .get(assignmentId) as AssignmentRow | undefined;
  if (!assignment) {
    return NextResponse.json({ error: "Topshiriq topilmadi." }, { status: 404 });
  }

  const profile: StudentProfile = {
    name: user.name,
    interests: parseJsonArray(user.interests, [] as string[]),
    learningStyle: user.learning_style || "Viktorina",
  };

  const existing = db
    .prepare(
      "SELECT * FROM sessions WHERE assignment_id = ? AND student_id = ? AND status = 'active'"
    )
    .get(assignmentId, user.id);
  if (existing) {
    const row = existing as { id: number; questions: string; results: string; mastery: number };
    const questions = parseJsonArray<Question>(row.questions, []);
    const results = parseJsonArray<QuestionResult>(row.results, []);
    const nextIndex = results.findIndex((r) => !r.done);
    return NextResponse.json({
      sessionId: row.id,
      questions: toSafeAll(questions),
      nextIndex: nextIndex === -1 ? 0 : nextIndex,
      doneCount: results.filter((r) => r.done).length,
      mastery: row.mastery ?? 0,
      profile,
      assignment: { id: assignment.id, title: assignment.title },
      resumed: true,
    });
  }

  const { questions } = await safeGenerateQuestions(
    profile,
    assignment.title,
    assignment.content
  );

  // Gemini validator (secondary): if key exists and finds invalid questions, use fallback set.
  const invalidIds = await validateQuestions(questions);
  const finalQuestions = invalidIds && invalidIds.length > 0 ? fallbackQuestions() : questions;

  const results: QuestionResult[] = finalQuestions.map(() => ({
    attempts: 0,
    solved: false,
    done: false,
  }));

  const sessionId = db
    .prepare("INSERT INTO sessions (assignment_id, student_id, questions, results) VALUES (?, ?, ?, ?)")
    .run(
      assignmentId,
      user.id,
      JSON.stringify(finalQuestions),
      JSON.stringify(results)
    ).lastInsertRowid as number;

  return NextResponse.json({
    sessionId,
    questions: toSafeAll(finalQuestions),
    nextIndex: 0,
    profile,
    assignment: { id: assignment.id, title: assignment.title },
    resumed: false,
  });
}
