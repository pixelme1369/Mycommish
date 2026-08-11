import type { DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      agentId?: string;
      isAdmin: boolean;
      role: "admin" | "manager" | "agent";
      displayName: string;
      aliasNames: string[];
      employmentType: "employee" | "contractor";
      companyName: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    isAdmin?: boolean;
    role?: "admin" | "manager" | "agent";
    displayName?: string;
    aliasNames?: string[];
    employmentType?: "employee" | "contractor";
    companyName?: string | null;
    agentCheckedAt?: number;
  }
}

// silence unused if tooling checks
export type { JWT };
