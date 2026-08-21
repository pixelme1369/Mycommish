import type { DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { AgentRoleName } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      agentId?: string;
      isAdmin: boolean;
      role: AgentRoleName;
      displayName: string;
      aliasNames: string[];
      employmentType: "employee" | "contractor";
      companyName: string | null;
      /** Set while an admin is viewing the portal as another user. */
      impersonatorAgentId?: string;
      impersonatorDisplayName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    isAdmin?: boolean;
    role?: AgentRoleName;
    displayName?: string;
    aliasNames?: string[];
    employmentType?: "employee" | "contractor";
    companyName?: string | null;
    agentCheckedAt?: number;
    impersonatorAgentId?: string;
    impersonatorEmail?: string;
    impersonatorDisplayName?: string;
  }
}

// silence unused if tooling checks
export type { JWT };
