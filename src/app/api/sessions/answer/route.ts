import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateAdaptive } from "@/lib/ai/claude";
import { computeMastery, fallbackAdaptive } from "@/lib/ai/fallback";
import { parseJsonArray, toSafe } from "@/lib/helpers";
import type { Question, QuestionResult, SessionRow } from "@/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { sessionId?: number; questionIndex?: number; answerIndex?: number }
    | null;
  const sessionId = Number(body?.sessionId);
  const questionIndex = Number(body?.questionIndex);
  const answerIndex = Number(body?.answerIndex);
  if (!Number.isInteger(sessionId) || !Number.isInteger(questionIndex) || !Number.isInteger(answerIndex)) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }

  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  if (!session || session.student_id !== user.id || session.status !== "active") {
    return NextResponse.json({ error: "Sessiya topilmadi." }, { status: 404 });
  }

  const questions = parseJsonArray<Question>(session.questions, []);
  const results = parseJsonArray<QuestionResult>(session.results, []);
  const result = results[questionIndex];
  const question = questions[questionIndex];
  if (!result || !question || result.done) {
    return NextResponse.json({ error: "Bu savol allaqachon yakunlangan." }, { status: 400 });
  }

  const correct = answerIndex === question.correctIndex;
  result.attempts += 1;

  const nextIndex = results.findIndex((r, i) => i !== questionIndex && !r.done);
  const answerResponse = {
    questionIndex,
    correctText: question.options[question.correctIndex],
    concept: question.concept,
  };

  if (correct) {
    result.solved = true;
    result.done = true;
    const mastery = computeMastery(results);
    const completed = results.every((r) => r.done);
    db.prepare("UPDATE sessions SET questions = ?, results = ?, mastery = ? WHERE id = ?").run(
      JSON.stringify(questions),
      JSON.stringify(results),
      mastery,
      sessionId
    );
    return NextResponse.json({
      ...answerResponse,
      correct: true,
      revealed: false,
      mastery,
      nextIndex: completed ? null : nextIndex,
      completed,
    });
  }

  if (result.attempts >= 3) {
    result.done = true;
    const mastery = computeMastery(results);
    const completed = results.every((r) => r.done);
    db.prepare("UPDATE sessions SET questions = ?, results = ?, mastery = ? WHERE id = ?").run(
      JSON.stringify(questions),
      JSON.stringify(results),
      mastery,
      sessionId
    );
    return NextResponse.json({
      ...answerResponse,
      correct: false,
      revealed: true,
      mastery,
      nextIndex: completed ? null : nextIndex,
      completed,
    });
  }

  const profile = { name: user.name, interests: parseJsonArray(user.interests, [] as string[]) };
  let message: string;
  let adaptiveQuestion: Question;
  try {
    const adaptive = await generateAdaptive(
      { ...profile, learningStyle: user.learning_style || "Viktorina" } as never,
      question,
      question.options[answerIndex],
      result.attempts
    );
    message = adaptive.message;
    adaptiveQuestion = adaptive.question;
  } catch {
    const adaptive = fallbackAdaptive(question, result.attempts);
    message = adaptive.message;
    adaptiveQuestion = adaptive.question;
  }

  questions[questionIndex] = adaptiveQuestion;
  const mastery = computeMastery(results);
  db.prepare("UPDATE sessions SET questions = ?, results = ?, mastery = ? WHERE id = ?").run(
    JSON.stringify(questions),
    JSON.stringify(results),
    mastery,
    sessionId
  );

  return NextResponse.json({
    ...answerResponse,
    correct: false,
    revealed: false,
    message,
    question: toSafe(adaptiveQuestion),
    mastery,
    completed: false,
  });
}
