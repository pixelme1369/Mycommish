import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { isAdminRole, type AgentRoleName } from "@/lib/roles";

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

type AgentClaims = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  role: AgentRoleName;
  employmentType: "employee" | "contractor";
  companyName: string | null;
  aliases: Array<{ agentName: string }>;
};

function clearAgentClaims(token: JWT) {
  token.agentId = undefined;
  token.isAdmin = false;
  token.role = undefined;
  token.aliasNames = [];
  token.displayName = undefined;
  token.employmentType = undefined;
  token.companyName = undefined;
}

function applyAgentClaims(token: JWT, agent: AgentClaims) {
  token.email = agent.email;
  token.agentId = agent.id;
  token.isAdmin = agent.isAdmin || isAdminRole(agent.role);
  token.role = agent.role;
  token.displayName = agent.displayName;
  token.aliasNames = agent.aliases.map((a) => a.agentName);
  token.employmentType = agent.employmentType;
  token.companyName = agent.companyName;
  token.name = agent.displayName;
}

function clearImpersonation(token: JWT) {
  token.impersonatorAgentId = undefined;
  token.impersonatorEmail = undefined;
  token.impersonatorDisplayName = undefined;
}

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

    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        token.email = user.email;
        clearImpersonation(token);
      }

      // Admin "login as user" — only when the current token is a real admin
      // (not already impersonating). Client can call session.update({…}).
      if (trigger === "update" && session && typeof session === "object") {
        const payload = session as {
          impersonateAgentId?: string;
          stopImpersonation?: boolean;
        };

        if (payload.stopImpersonation && token.impersonatorEmail) {
          token.email = token.impersonatorEmail;
          clearImpersonation(token);
          token.agentCheckedAt = 0;
        } else if (
          payload.impersonateAgentId &&
          token.isAdmin &&
          !token.impersonatorAgentId &&
          token.agentId &&
          payload.impersonateAgentId !== token.agentId
        ) {
          const target = await prisma.agent.findUnique({
            where: { id: payload.impersonateAgentId },
            include: { aliases: true },
          });
          if (target && !target.suspendedAt) {
            token.impersonatorAgentId = token.agentId;
            token.impersonatorEmail = String(token.email || "");
            token.impersonatorDisplayName = token.displayName;
            applyAgentClaims(token, target);
            token.agentCheckedAt = Date.now();
            return token;
          }
        }
      }

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
        // If the impersonated user is suspended/missing, bounce back to admin.
        if (token.impersonatorEmail) {
          const adminEmail = token.impersonatorEmail;
          clearImpersonation(token);
          const admin = await prisma.agent.findUnique({
            where: { email: adminEmail },
            include: { aliases: true },
          });
          if (admin && !admin.suspendedAt) {
            applyAgentClaims(token, admin);
            return token;
          }
        }
        clearAgentClaims(token);
        return token;
      }

      applyAgentClaims(token, agent);
      return token;
    },
  },
});
