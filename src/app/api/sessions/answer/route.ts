import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { adaptToMistake } from "@/lib/ai/personalization/adapt";
import { computeMastery } from "@/lib/ai/personalization/fallback";
import {
  isCorrectAnswer,
  judgeFreeResponse,
  wrongAnswerText,
} from "@/lib/ai/personalization/grading";
import { answerText, parseJsonArray, toSafeActivity } from "@/lib/helpers";
import type { Activity, AnswerPayload, Experience, SessionRow, StudentProfile } from "@/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { sessionId?: number; activityIndex?: number; answer?: AnswerPayload }
    | null;
  const sessionId = Number(body?.sessionId);
  const activityIndex = Number(body?.activityIndex);
  const answer = body?.answer;
  if (!Number.isInteger(sessionId) || !Number.isInteger(activityIndex) || !answer) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }

  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  if (!session || session.student_id !== user.id || session.status !== "active") {
    return NextResponse.json({ error: "Sessiya topilmadi." }, { status: 404 });
  }

  const experience = parseJsonArray<Experience>(session.questions, [])[0];
  if (!experience) return NextResponse.json({ error: "Tajriba topilmadi." }, { status: 404 });

  const results = parseJsonArray<{ attempts: number; solved: boolean; done: boolean; routes?: string[] }>(
    session.results,
    []
  ).map((r) => ({
    attempts: r.attempts ?? 0,
    solved: Boolean(r.solved),
    done: Boolean(r.done),
    routes: Array.isArray(r.routes) ? r.routes : [],
  }));
  const result = results[activityIndex];
  const activity = experience.activities[activityIndex];
  if (!result || !activity || result.done) {
    return NextResponse.json({ error: "Bu qadam allaqachon yakunlangan." }, { status: 400 });
  }

  const profile: StudentProfile = {
    name: user.name,
    interests: parseJsonArray(user.interests, [] as string[]),
    learningStyle: user.learning_style || "",
  };

  // Grading: deterministic for choice/numeric/ordering, AI for free responses
  let correct = isCorrectAnswer(activity, answer);
  let successMessage: string | null = null;
  if (correct === null) {
    const text = (answer.text ?? "").trim() || answerText(activity, answer);
    if (!text || text === "(javob yozilmadi)") {
      return NextResponse.json({ error: "Javob bo'sh." }, { status: 400 });
    }
    const judged = await judgeFreeResponse(activity, text);
    correct = judged.correct;
    if (judged.correct) successMessage = judged.message;
  }

  result.attempts += 1;
  const nextIndexRaw = results.findIndex((r, i) => i !== activityIndex && !r.done);
  const baseResponse = {
    activityIndex,
    solution: activity.solution,
    concept: activity.concept,
  };

  const persist = (mastery: number) =>
    db.prepare("UPDATE sessions SET questions = ?, results = ?, mastery = ? WHERE id = ?").run(
      session.questions,
      JSON.stringify(results),
      mastery,
      sessionId
    );

  if (correct) {
    result.solved = true;
    result.done = true;
    const mastery = computeMastery(results);
    const completed = results.every((r) => r.done);
    persist(mastery);
    return NextResponse.json({
      ...baseResponse,
      correct: true,
      revealed: false,
      message: successMessage,
      mastery,
      nextIndex: completed ? null : nextIndexRaw,
      completed,
    });
  }

  if (result.attempts >= 3) {
    result.done = true;
    const mastery = computeMastery(results);
    const completed = results.every((r) => r.done);
    persist(mastery);
    return NextResponse.json({
      ...baseResponse,
      correct: false,
      revealed: true,
      mastery,
      nextIndex: completed ? null : nextIndexRaw,
      completed,
    });
  }

  // Wrong answer → diagnose and re-teach through a different cognitive route
  const adaptation = await adaptToMistake({
    profile,
    experienceTypeLabel: experience.typeLabel,
    original: activity,
    wrongAnswer: wrongAnswerText(activity, answer),
    attemptNo: result.attempts,
  });

  const newExperience: Experience = {
    ...experience,
    activities: experience.activities.map((a: Activity, i: number) => (i === activityIndex ? adaptation.activity : a)),
  };
  result.routes.push(adaptation.route);
  const mastery = computeMastery(results);
  db.prepare("UPDATE sessions SET questions = ?, results = ?, mastery = ? WHERE id = ?").run(
    JSON.stringify([newExperience]),
    JSON.stringify(results),
    mastery,
    sessionId
  );

  return NextResponse.json({
    ...baseResponse,
    correct: false,
    revealed: false,
    message: adaptation.message,
    route: adaptation.route,
    activity: toSafeActivity(adaptation.activity),
    mastery,
    completed: false,
  });
}
