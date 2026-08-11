import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

providers.push(
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password || "");
      if (!email || !password) return null;

      const agent = await prisma.agent.findUnique({ where: { email } });
      if (!agent?.passwordHash) return null;
      if (agent.suspendedAt) return null;

      const ok = await bcrypt.compare(password, agent.passwordHash);
      if (!ok) return null;

      return {
        id: agent.id,
        email: agent.email,
        name: agent.displayName,
      };
    },
  }),
);

export const googleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      const email = (user.email || "").trim().toLowerCase();
      if (!email) return false;
      const agent = await prisma.agent.findUnique({ where: { email } });
      if (!agent || agent.suspendedAt) return false;

      await prisma.agent.update({
        where: { id: agent.id },
        data: { lastLoginAt: new Date() },
      });
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.email) token.email = user.email;

      // Neon round-trips are ~100ms+. Refresh claims on sign-in / update /
      // missing agentId; also re-check every ~2m so suspend takes effect.
      const lastCheck =
        typeof token.agentCheckedAt === "number" ? token.agentCheckedAt : 0;
      const claimsStale = Date.now() - lastCheck > 2 * 60 * 1000;
      const needsDb =
        Boolean(user) ||
        trigger === "update" ||
        token.agentId == null ||
        claimsStale;
      if (!needsDb) return token;

      const email = String(token.email || "")
        .trim()
        .toLowerCase();
      if (!email) return token;

      const agent = await prisma.agent.findUnique({
        where: { email },
        include: { aliases: true },
      });
      token.agentCheckedAt = Date.now();
      if (!agent || agent.suspendedAt) {
        token.agentId = undefined;
        token.isAdmin = false;
        token.role = undefined;
        token.aliasNames = [];
        token.displayName = undefined;
        token.employmentType = undefined;
        token.companyName = undefined;
        return token;
      }

      token.agentId = agent.id;
      token.isAdmin = agent.isAdmin || agent.role === "admin";
      token.role = agent.role;
      token.displayName = agent.displayName;
      token.aliasNames = agent.aliases.map((a) => a.agentName);
      token.employmentType = agent.employmentType;
      token.companyName = agent.companyName;
      return token;
    },
  },
});
