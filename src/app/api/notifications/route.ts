import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });

  const items = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30")
    .all(user.id);
  const unread = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };

  return NextResponse.json({ items, unread: unread.c });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  return NextResponse.json({ ok: true });
}
