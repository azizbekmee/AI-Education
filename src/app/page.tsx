import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "teacher" ? "/teacher" : "/student");
  }
  redirect("/login");
}
