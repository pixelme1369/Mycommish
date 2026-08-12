import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function homePath(user: { isAdmin?: boolean; role?: string } | undefined) {
  if (user?.isAdmin || user?.role === "admin") return "/admin";
  if (user?.role === "manager") return "/manager";
  return "/portal";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as
    | { agentId?: string; isAdmin?: boolean; role?: string }
    | undefined;
  const isLoggedIn = Boolean(user?.agentId);
  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  const isManager = user?.role === "manager";
  const canStaffView = isAdmin || isManager;

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

  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL(homePath(user), req.nextUrl.origin));
  }

  if (pathname.startsWith("/manager") && !canStaffView) {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
