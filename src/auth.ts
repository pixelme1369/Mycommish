import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
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

        const ok = await bcrypt.compare(password, agent.passwordHash);
        if (!ok) return null;

        return {
          id: agent.id,
          email: agent.email,
          name: agent.displayName,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      const email = (user.email || "").trim().toLowerCase();
      if (!email) return false;
      const agent = await prisma.agent.findUnique({ where: { email } });
      return Boolean(agent);
    },

    async jwt({ token, user, trigger }) {
      if (user?.email) token.email = user.email;

      // Neon round-trips are ~100ms+. Only refresh agent claims on sign-in /
      // explicit update — not on every session/page render.
      const needsDb =
        Boolean(user) || trigger === "update" || token.agentId == null;
      if (!needsDb) return token;

      const email = String(token.email || "")
        .trim()
        .toLowerCase();
      if (!email) return token;

      const agent = await prisma.agent.findUnique({
        where: { email },
        include: { aliases: true },
      });
      if (!agent) {
        token.agentId = undefined;
        token.isAdmin = false;
        token.aliasNames = [];
        token.displayName = undefined;
        token.employmentType = undefined;
        token.companyName = undefined;
        return token;
      }

      token.agentId = agent.id;
      token.isAdmin = agent.isAdmin;
      token.displayName = agent.displayName;
      token.aliasNames = agent.aliases.map((a) => a.agentName);
      token.employmentType = agent.employmentType;
      token.companyName = agent.companyName;
      return token;
    },
  },
});
