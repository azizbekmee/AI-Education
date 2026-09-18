import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  title: z.string().min(2),
  content: z.string().min(5),
  fileName: z.string().optional().nullable(),
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
      { error: "Sarlavha va topshiriq matnini to'liq kiriting." },
      { status: 400 }
    );
  }

  const id = db
    .prepare("INSERT INTO assignments (teacher_id, title, content, file_name) VALUES (?, ?, ?, ?)")
    .run(user.id, parsed.data.title.trim(), parsed.data.content.trim(), parsed.data.fileName ?? null)
    .lastInsertRowid as number;

  return NextResponse.json({ id });
}
