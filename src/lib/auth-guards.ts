import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import {
  roleGrantsAdminConsole,
  roleHasManagerCapabilities,
  toAppRole,
  type AppRole,
} from "@/lib/roles";

export type { AppRole };

export function sessionRole(session: Session): AppRole {
  return toAppRole(session.user.role, session.user.isAdmin);
}

/** Full admin console (uploads, delete, Gusto, dismiss, claim review). Includes super_admin. */
export function isAdminUser(session: Session): boolean {
  return roleGrantsAdminConsole(session.user.role, session.user.isAdmin);
}

export function isSuperAdminUser(session: Session): boolean {
  return session.user.role === "super_admin";
}

/** Literal manager role only (not super_admin). Prefer `canActAsManager` for gates. */
export function isManagerUser(session: Session): boolean {
  return session.user.role === "manager";
}

/**
 * Manager capabilities: managers and super_admin.
 * Super admin inherits every role’s abilities.
 */
export function canActAsManager(session: Session): boolean {
  return roleHasManagerCapabilities(session.user.role);
}

/** Manager, admin, or super_admin — can view all agents’ commissions / files. */
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

/** Managers and super_admin (inherits manager tools). */
export async function requireManager() {
  const session = await requireSession();
  if (!canActAsManager(session)) redirect(homePathForSession(session));
  return session;
}

/** Super admin only — e.g. approve manual bonuses. */
export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!isSuperAdminUser(session)) redirect(homePathForSession(session));
  return session;
}

/** Managers, admins, and super_admin — team commission views. */
export async function requireManagerOrAdmin() {
  const session = await requireSession();
  if (!canViewAllCommissions(session)) redirect("/portal");
  return session;
}
