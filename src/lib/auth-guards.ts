import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.agentId) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session.user.isAdmin) redirect("/portal");
  return session;
}
