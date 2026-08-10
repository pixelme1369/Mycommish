import type { DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      agentId?: string;
      isAdmin: boolean;
      displayName: string;
      aliasNames: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    isAdmin?: boolean;
    displayName?: string;
    aliasNames?: string[];
  }
}

// silence unused if tooling checks
export type { JWT };
