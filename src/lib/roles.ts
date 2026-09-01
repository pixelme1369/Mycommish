/** Portal login roles (mirrors Prisma `AgentRole`). */
export type AgentRoleName = "super_admin" | "admin" | "manager" | "agent" | "opener";

/**
 * Capability tier for routing / most gates.
 * `super_admin` maps to `admin` here (home → /admin) and also has manager
 * capabilities via `roleHasManagerCapabilities`.
 */
export type AppRole = "admin" | "manager" | "agent";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function isOpenerRole(role: string | null | undefined): boolean {
  return role === "opener";
}

/** Manager tools (manual bonus, team views, countersign) — managers + super_admin. */
export function roleHasManagerCapabilities(
  role: string | null | undefined,
): boolean {
  return role === "manager" || role === "super_admin";
}

export function roleGrantsAdminConsole(
  role: string | null | undefined,
  isAdminFlag?: boolean,
): boolean {
  return Boolean(isAdminFlag) || isAdminRole(role);
}

export function toAppRole(
  role: string | null | undefined,
  isAdminFlag?: boolean,
): AppRole {
  if (roleGrantsAdminConsole(role, isAdminFlag)) return "admin";
  if (role === "manager") return "manager";
  return "agent";
}

/** Short label for page eyebrows (M · super admin). */
export function formatRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "super admin";
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "agent":
      return "agent";
    case "opener":
      return "opener";
    default:
      return "portal";
  }
}

/** Back-link / nav text for the shared `/admin` console. */
export function adminHomeLinkLabel(role: string | null | undefined): string {
  return role === "super_admin" ? "← Super admin" : "← Admin";
}

/** Short CTA when linking into `/admin` from portal/manager. */
export function adminNavLabel(role: string | null | undefined): string {
  return role === "super_admin" ? "Super admin" : "Admin";
}
