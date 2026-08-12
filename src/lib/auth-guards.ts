import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export type AppRole = "admin" | "manager" | "agent";

export function sessionRole(session: Session): AppRole {
  if (session.user.isAdmin || session.user.role === "admin") return "admin";
  if (session.user.role === "manager") return "manager";
  return "agent";
}

/** Full admin console (uploads, delete, Gusto, dismiss, claim review). */
export function isAdminUser(session: Session): boolean {
  return sessionRole(session) === "admin";
}

/** Manager or admin — can view all agents’ commissions / files. */
export function canViewAllCommissions(session: Session): boolean {
  const role = sessionRole(session);
  return role === "admin" || role === "manager";
}

export function homePathForSession(session: Session): string {
  const role = sessionRole(session);
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/portal";
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.agentId) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminUser(session)) redirect(homePathForSession(session));
  return session;
}

/** Managers and admins — read-only team commission views. */
export async function requireManagerOrAdmin() {
  const session = await requireSession();
  if (!canViewAllCommissions(session)) redirect("/portal");
  return session;
}
