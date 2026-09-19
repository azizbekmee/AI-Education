import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { designExperience } from "@/lib/ai/personalization/engine";
import { fallbackExperience } from "@/lib/ai/personalization/fallback";
import { validateExperience } from "@/lib/ai/gemini";
import { parseJsonArray, toSafeExperience } from "@/lib/helpers";
import type { AssignmentRow, Experience, SessionRow, StudentProfile } from "@/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Bu amal faqat o'quvchilar uchun." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { assignmentId?: number; todayInterest?: string; mood?: string; workMode?: string }
    | null;
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
    learningStyle: user.learning_style || "",
  };

  // Existing active session → resume (experience already designed)
  const existing = db
    .prepare(
      "SELECT * FROM sessions WHERE assignment_id = ? AND student_id = ? AND status = 'active'"
    )
    .get(assignmentId, user.id) as SessionRow | undefined;
  if (existing) {
    const experience = parseJsonArray<Experience>(existing.questions, [])[0];
    if (!experience || !Array.isArray(experience.activities) || experience.activities.length === 0) {
      // corrupt or legacy-format session — drop it and design a fresh one
      db.prepare("DELETE FROM sessions WHERE id = ?").run(existing.id);
    } else {
      const results = parseJsonArray<{ attempts: number; solved: boolean; done: boolean; routes?: string[] }>(
        existing.results,
        []
      );
      const nextIndex = results.findIndex((r) => !r.done);
      return NextResponse.json({
        sessionId: existing.id,
        experience: toSafeExperience(experience),
        nextIndex: nextIndex === -1 ? 0 : nextIndex,
        doneCount: results.filter((r) => r.done).length,
        mastery: existing.mastery ?? 0,
        todayInterest: existing.today_interest ?? "",
        resumed: true,
      });
    }
  }

  // New session: if the student hasn't picked today's interest yet, ask first
  if (!body || typeof body.todayInterest === "undefined") {
    return NextResponse.json({ needsInterest: true, profile });
  }
  const todayInterest = (body.todayInterest ?? "").trim();
  const mood = (body.mood ?? "").trim().slice(0, 40);
  const workMode = (body.workMode ?? "").trim().slice(0, 20);

  // Previous performance feeds the personalization engine
  const prevReport = db
    .prepare("SELECT mastery, weaknesses FROM reports WHERE student_id = ? ORDER BY id DESC LIMIT 1")
    .get(user.id) as { mastery: number; weaknesses: string } | undefined;
  const previousMastery = prevReport ? Math.round(prevReport.mastery) : null;
  const previousWeaknesses = prevReport ? parseJsonArray(prevReport.weaknesses, [] as string[]) : [];

  // The teacher's original assignment is the immutable source of truth — the designed
  // experience must build on exactly these questions, never invent replacements.
  let originalBlock = "";
  if (assignment.original) {
    try {
      const orig = JSON.parse(assignment.original) as {
        requirements?: string[];
        questions?: { text: string }[];
        instruction?: string;
      };
      const lines: string[] = [];
      if (orig.questions?.length) {
        lines.push(
          "ORIGINAL SAVOLLAR (source of truth — o'quvchi AYNAN shu savollarni bajarishi shart, boshqa savol ixtiro qilma):",
          ...orig.questions.map((q, i) => `${i + 1}. ${q.text}`)
        );
      }
      if (orig.requirements?.length) {
        lines.push("ORIGINAL TALABLAR:", ...orig.requirements.map((r) => `- ${r}`));
      }
      if (orig.instruction) {
        lines.push(`O'QITUVCHI KO'RSATMASI: ${orig.instruction}`);
      }
      if (lines.length) originalBlock = `\n\n${lines.join("\n")}\n`;
    } catch {
      /* legacy row — ignore */
    }
  }

  const { experience: designed, source } = await designExperience({
    profile,
    assignmentTitle: assignment.title,
    assignmentContent: assignment.content + originalBlock,
    todayInterest,
    workMode,
    previousMastery,
    previousWeaknesses,
  });

  // Gemini validator (optional secondary review) — invalid design falls back
  let experience = designed;
  if (source === "ai") {
    const invalidIds = await validateExperience(designed);
    if (invalidIds && invalidIds.length > 0) {
      experience = fallbackExperience({
        name: profile.name,
        topicTitle: assignment.title,
        interests: profile.interests,
        todayInterest,
      });
    }
  }

  const results = experience.activities.map(() => ({
    attempts: 0,
    solved: false,
    done: false,
    routes: [] as string[],
  }));

  const sessionId = db
    .prepare(
      "INSERT INTO sessions (assignment_id, student_id, questions, results, today_interest, mood, work_mode) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(assignmentId, user.id, JSON.stringify([experience]), JSON.stringify(results), todayInterest, mood, workMode)
    .lastInsertRowid as number;

  return NextResponse.json({
    sessionId,
    experience: toSafeExperience(experience),
    nextIndex: 0,
    doneCount: 0,
    mastery: 0,
    todayInterest,
    resumed: false,
  });
}
