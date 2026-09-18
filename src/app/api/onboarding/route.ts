import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  interests: z.array(z.string().min(1)).min(1),
  learningStyle: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Bu sahifa faqat o'quvchilar uchun." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Kamida bitta qiziqish va o'rganish usulini tanlang." },
      { status: 400 }
    );
  }

  db.prepare(
    "UPDATE users SET interests = ?, learning_style = ?, profile_completed = 1 WHERE id = ?"
  ).run(JSON.stringify(parsed.data.interests), parsed.data.learningStyle, user.id);

  return NextResponse.json({ ok: true });
}
