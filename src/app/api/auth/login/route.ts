import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import type { UserRow } from "@/types";

const bodySchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Iltimos, barcha maydonlarni to'ldiring." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;

  if (!user || user.password !== parsed.data.password) {
    return NextResponse.json({ error: "Email yoki parol noto'g'ri." }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({
    role: user.role,
    profileCompleted: Boolean(user.profile_completed),
  });
}
