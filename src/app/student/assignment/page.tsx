import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AssignmentFlow from "@/components/AssignmentFlow";

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

  return <AssignmentFlow name={user.name} assignmentId={id} />;
}
