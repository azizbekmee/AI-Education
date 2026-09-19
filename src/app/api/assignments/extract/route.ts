import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { validateAssignmentTarget } from "@/lib/teacher-context";
import { extractAssignment, type ExtractInput } from "@/lib/ai/extract";
import type { AiFileBlock } from "@/lib/ai/claude";

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  type: z.string().min(1).max(150),
  data: z.string().max(16 * 1024 * 1024).nullable().optional(),
  text: z.string().max(400_000).nullable().optional(),
});

const bodySchema = z.object({
  classId: z.number().int().positive(),
  topicId: z.number().int().positive(),
  note: z.string().max(3000).default(""),
  files: z.array(fileSchema).min(1).max(10),
});

/** AI preview extraction: analyses the uploaded files without saving anything. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  if (user.role !== "teacher") {
    return NextResponse.json({ error: "Bu amal faqat o'qituvchilar uchun." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ma'lumotlar to'liq emas yoki noto'g'ri." }, { status: 400 });
  }

  const { classId, topicId, note, files } = parsed.data;

  const target = validateAssignmentTarget(user.id, classId, topicId);
  if (!target.ok) {
    const status = target.error.includes("biriktirilmagan") ? 403 : 400;
    return NextResponse.json({ error: target.error }, { status });
  }

  const blocks: AiFileBlock[] = [];
  for (const f of files) {
    const text = f.text?.trim();
    if (text) {
      blocks.push({ kind: "text", name: f.name, text });
    } else if (f.data) {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        blocks.push({ kind: "pdf", name: f.name, base64: f.data });
      } else if (f.type.startsWith("image/")) {
        blocks.push({ kind: "image", name: f.name, mediaType: f.type, base64: f.data });
      } else {
        blocks.push({
          kind: "text",
          name: f.name,
          text: `[Fayl: ${f.name} — matn ajratib olinmagan (${f.type})]`,
        });
      }
    }
  }
  if (blocks.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "Fayllarda tahlil qilinadigan kontent topilmadi. Boshqa fayl yuklang.",
    });
  }

  const input: ExtractInput = {
    className: target.className,
    topicName: target.topicName,
    note,
    files: blocks,
  };
  const result = await extractAssignment(input);
  return NextResponse.json(result);
}
