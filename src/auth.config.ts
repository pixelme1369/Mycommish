import type { NextAuthConfig } from "next-auth";

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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
