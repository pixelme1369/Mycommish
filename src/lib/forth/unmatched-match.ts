import { agentIdentityKey } from "@/lib/commission/calculator";

export function lastNameToken(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] || "").toLowerCase();
}

function nameTokens(parts: string[]): string[] {
  return parts
    .flatMap((s) => s.toLowerCase().split(/[^a-z0-9]+/))
    .filter((t) => t.length >= 2);
}

/** Higher score = more likely this Forth assigned_to belongs to this portal user. */
export function scoreForthUserMatch(
  forthName: string,
  user: { displayName: string; aliases: string[] },
): number {
  const last = lastNameToken(forthName);
  if (last.length < 2) return 0;
  const tokens = nameTokens([user.displayName, ...user.aliases]);
  if (tokens.includes(last)) return 2;
  const first = forthName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (first.length >= 2 && tokens.includes(first)) return 1;
  return 0;
}

export function sortUsersForForthName<T extends { displayName: string; aliases: string[] }>(
  forthName: string,
  users: T[],
): { likely: T[]; rest: T[] } {
  const scored = users.map((u) => ({ u, score: scoreForthUserMatch(forthName, u) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.u.displayName.localeCompare(b.u.displayName);
  });
  return {
    likely: scored.filter((s) => s.score > 0).map((s) => s.u),
    rest: scored.filter((s) => s.score === 0).map((s) => s.u),
  };
}

export function isDismissedForthName(name: string, dismissed: Set<string>): boolean {
  return dismissed.has(agentIdentityKey(name));
}

export function filterUnmatchedForthNames<T extends { assignedTo: string }>(
  rows: T[],
  dismissed: Set<string>,
): T[] {
  return rows.filter((r) => !isDismissedForthName(r.assignedTo, dismissed));
}

export function filterForthMapUsers<T extends { displayName: string; aliases: string[] }>(
  users: T[],
  dismissed: Set<string>,
): T[] {
  return users.filter((u) => {
    if (dismissed.has(agentIdentityKey(u.displayName))) return false;
    return !u.aliases.some((a) => dismissed.has(agentIdentityKey(a)));
  });
}
