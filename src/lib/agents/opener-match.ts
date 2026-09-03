import { agentIdentityKey } from "@/lib/commission/calculator";

/** Match Forth Transfer Agent name → opener agentId (aliases + displayName). */
export function openerIdForTransferAgent(
  transferAgent: string | null | undefined,
  byName: Map<string, string>,
): string | null {
  const key = agentIdentityKey(transferAgent || "");
  if (!key) return null;
  return byName.get(key) ?? null;
}
