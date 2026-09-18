import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";
import type { UserRow } from "@/types";

const COOKIE_NAME = "ae_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret";
const MAX_AGE = 60 * 60 * 24 * 7;

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export async function setSessionCookie(userId: number) {
  const store = await cookies();
  const payload = String(userId);
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  const id = Number(payload);
  if (!Number.isInteger(id)) return null;
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ?? null;
}
