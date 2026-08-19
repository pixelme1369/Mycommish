/** Mutate CRM clients so commission + directory use the locked Sales Rep. */
export function applySalesRepOverrides<
  T extends { crmId?: string | null; externalId?: string | null; agentName: string },
>(clients: T[], overrides: Map<string, string> | Record<string, string> | undefined): number {
  if (!overrides) return 0;
  const map =
    overrides instanceof Map ? overrides : new Map(Object.entries(overrides));
  if (!map.size) return 0;

  let n = 0;
  for (const c of clients) {
    const ext = c.externalId?.trim();
    const id = c.crmId?.trim();
    const next = (ext && map.get(ext)) || (id && map.get(id)) || null;
    if (!next || next === c.agentName) continue;
    c.agentName = next;
    n += 1;
  }
  return n;
}
