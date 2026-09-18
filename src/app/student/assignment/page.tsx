import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AssignmentFlow from "@/components/AssignmentFlow";
import { parseJsonArray } from "@/lib/helpers";
import type { StudentProfile } from "@/types";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/teacher");
  if (!user.profile_completed) redirect("/onboarding");

  const { assignmentId } = await searchParams;
  const id = Number(assignmentId);
  if (!Number.isInteger(id)) redirect("/student");

  const profile: StudentProfile = {
    name: user.name,
    interests: parseJsonArray(user.interests, [] as string[]),
    learningStyle: user.learning_style || "",
  };

  return <AssignmentFlow name={user.name} assignmentId={id} profile={profile} />;
}
