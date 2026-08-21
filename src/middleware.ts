import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { roleGrantsAdminConsole, roleHasManagerCapabilities, toAppRole } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

function homePath(user: { isAdmin?: boolean; role?: string } | undefined) {
  const role = toAppRole(user?.role, user?.isAdmin);
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/portal";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as
    | { agentId?: string; isAdmin?: boolean; role?: string }
    | undefined;
  const isLoggedIn = Boolean(user?.agentId);
  const isAdmin = roleGrantsAdminConsole(user?.role, user?.isAdmin);
  const isSuperAdmin = user?.role === "super_admin";
  const canStaffView = isAdmin || roleHasManagerCapabilities(user?.role);

  if (pathname.startsWith("/api/auth") || pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(homePath(user), req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/superadmin") && !isSuperAdmin) {
    return NextResponse.redirect(new URL(homePath(user), req.nextUrl.origin));
  }

  // Managers may review file claims; rest of /admin stays admin-only.
  const isAdminClaimsPath =
    pathname === "/admin/claims" || pathname.startsWith("/admin/claims/");
  if (pathname.startsWith("/admin") && !isAdmin) {
    if (!(isAdminClaimsPath && roleHasManagerCapabilities(user?.role))) {
      return NextResponse.redirect(new URL(homePath(user), req.nextUrl.origin));
    }
  }

  if (pathname.startsWith("/manager") && !canStaffView) {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  // Super admins have no agent commissions / CRM aliases — skip agent portal home.
  if (
    isSuperAdmin &&
    (pathname === "/portal" || pathname === "/portal/files" || pathname.startsWith("/portal/files/"))
  ) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
