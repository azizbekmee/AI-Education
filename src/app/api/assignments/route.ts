import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { validateAssignmentTarget } from "@/lib/teacher-context";
import type { OriginalAssignment } from "@/types";

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  type: z.string().min(1).max(150),
  /** base64 (PDF/images) or raw text — preserved verbatim for the AI extraction phase */
  data: z.string().max(16 * 1024 * 1024).nullable().optional(),
  text: z.string().max(400_000).nullable().optional(),
});

const originalSchema = z.object({
  requirements: z.array(z.string().min(1).max(1000)).max(30).default([]),
  questions: z
    .array(
      z.object({
        text: z.string().min(1).max(4000),
        answer: z.string().max(4000).default(""),
        answerType: z.enum(["numeric", "short", "free"]).default("short"),
      })
    )
    .max(100)
    .default([]),
  constraints: z.string().max(4000).default(""),
  wordCount: z.number().int().min(0).max(1_000_000).optional(),
  expectedOutput: z.string().max(2000).default(""),
  instruction: z.string().max(3000).default(""),
  extractedByAi: z.boolean().default(false),
});

const bodySchema = z.object({
  classId: z.number().int().positive(),
  topicId: z.number().int().positive(),
  title: z.string().min(2).max(150),
  note: z.string().max(3000).default(""),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  files: z.array(fileSchema).min(1).max(10),
  /** verbatim extraction produced by our own /api/assignments/extract endpoint */
  original: originalSchema.optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  if (user.role !== "teacher") {
    return NextResponse.json({ error: "Bu amal faqat o'qituvchilar uchun." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ma'lumotlar to'liq emas yoki noto'g'ri." },
      { status: 400 }
    );
  }

  const { classId, topicId, title, note, deadline, files, original: extracted } = parsed.data;

  // Server-side authorization: teacher must be bound to this class, subject and topic
  const target = validateAssignmentTarget(user.id, classId, topicId);
  if (!target.ok) {
    const status = target.error.includes("biriktirilmagan") ? 403 : 400;
    return NextResponse.json({ error: target.error }, { status });
  }

  // rawText is always rebuilt server-side from the uploaded files (immutable source of truth)
  const rawText = files
    .filter((f) => f.text && f.text.trim())
    .map((f) => `— ${f.name} —\n${f.text!.trim()}`)
    .join("\n\n");
  const hasAiQuestions = Boolean(extracted?.extractedByAi && extracted.questions.length > 0);
  const instruction = (extracted?.instruction || note.trim() || "").trim();

  const original: OriginalAssignment = {
    title: title.trim(),
    requirements: extracted?.requirements.length ? extracted.requirements : note.trim() ? [note.trim()] : [],
    questions: extracted?.questions ?? [],
    constraints: extracted?.constraints ?? "",
    rawText,
    extractedByAi: hasAiQuestions,
    wordCount: extracted?.wordCount,
    expectedOutput: (extracted?.expectedOutput || "").trim() || undefined,
    instruction: instruction || undefined,
  };

  const contentParts = [`${target.topicName} mavzusi bo'yicha topshiriq: ${title.trim()}`];
  if (note.trim()) contentParts.push(`O'qituvchi izohi: ${note.trim()}`);
  for (const f of files) {
    if (f.text && f.text.trim()) contentParts.push(`— ${f.name} —\n${f.text.trim()}`);
    else contentParts.push(`Ilova fayl: ${f.name} (${f.type})`);
  }
  const content = contentParts.join("\n\n");

  const id = db.transaction(() => {
    const assignmentId = db
      .prepare(
        `INSERT INTO assignments (teacher_id, class_id, subject_id, topic_id, title, content, note, original, deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.id,
        target.classId,
        target.subjectId,
        target.topicId,
        title.trim(),
        content,
        note.trim(),
        JSON.stringify(original),
        deadline ?? null
      ).lastInsertRowid as number;

    const insertFile = db.prepare(
      `INSERT INTO assignment_files (assignment_id, name, size, type, data, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const f of files) {
      const isText = Boolean(f.text && f.text.trim());
      insertFile.run(
        assignmentId,
        f.name,
        f.size,
        f.type,
        isText ? f.text : (f.data ?? null),
        isText ? f.text!.trim() : ""
      );
    }
    return assignmentId;
  })();

  return NextResponse.json({
    id,
    className: target.className,
    topicName: target.topicName,
    extractedByAi: original.extractedByAi,
    questionCount: original.questions.length,
  });
}
