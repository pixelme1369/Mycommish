import type { NextAuthConfig } from "next-auth";
import type { AgentRoleName } from "@/lib/roles";

/**
 * Edge-safe config (no Prisma). Middleware uses this to decode the JWT cookie.
 * Custom claims (agentId, isAdmin, …) are written by auth.ts jwt callback and
 * must be copied onto session.user here or middleware thinks nobody is logged in.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  debug: false,
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.agentId = token.agentId as string | undefined;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.displayName =
          (token.displayName as string) || session.user.name || "";
        session.user.aliasNames = (token.aliasNames as string[]) || [];
        session.user.employmentType =
          (token.employmentType as "employee" | "contractor" | undefined) || "employee";
        session.user.companyName = (token.companyName as string | null | undefined) ?? null;
        session.user.role =
          (token.role as AgentRoleName | undefined) ||
          (session.user.isAdmin ? "admin" : "agent");
        session.user.impersonatorAgentId = token.impersonatorAgentId as
          | string
          | undefined;
        session.user.impersonatorDisplayName = token.impersonatorDisplayName as
          | string
          | undefined;
        if (token.email) session.user.email = String(token.email);
        if (token.displayName) session.user.name = String(token.displayName);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
