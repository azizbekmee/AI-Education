import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseJsonArray } from "@/lib/helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      interests: parseJsonArray(user.interests, [] as string[]),
      learningStyle: user.learning_style,
      profileCompleted: Boolean(user.profile_completed),
    },
  });
}
