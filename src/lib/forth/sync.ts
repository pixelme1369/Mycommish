import { prisma } from "@/lib/db";
import { fetchAllForthContacts } from "./client";
import { mapForthContact, type MappedForthContact } from "./map-contact";
import { refreshOpenerTransferLogs } from "@/lib/opener/logs";

export type ForthSyncResult = {
  fetched: number;
  mapped: number;
  upserted: number;
  skipped: number;
  unmatchedAgents: string[];
  openerLogsChecked: number;
  openerLogsUpdated: number;
};

type RowToStore = Omit<MappedForthContact, "agentName"> & { agentId: string | null };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function upsertMapped(rows: RowToStore[]): Promise<number> {
  let upserted = 0;
  for (const batch of chunk(rows, 40)) {
    await prisma.$transaction(
      batch.map((r) => {
        const { forthId, ...fields } = r;
        return prisma.forthContact.upsert({
          where: { forthId },
          create: { forthId, ...fields },
          // Same forthId → overwrite Forth fields (status NSF → Cancelled, etc.).
          update: fields,
        });
      }),
    );
    upserted += batch.length;
  }
  return upserted;
}

export async function syncForthContacts(): Promise<ForthSyncResult> {
  const raw = await fetchAllForthContacts();
  const mapped: MappedForthContact[] = [];
  let skipped = 0;
  for (const item of raw) {
    const row = mapForthContact(item);
    if (!row) {
      skipped += 1;
      continue;
    }
    mapped.push(row);
  }

  const byId = new Map<string, MappedForthContact>();
  for (const row of mapped) byId.set(row.forthId, row);
  const unique = [...byId.values()];

  const names = [
    ...new Set(
      unique
        .map((r) => r.agentName?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const aliases = names.length
    ? await prisma.agentAlias.findMany({
        where: {
          OR: names.map((n) => ({
            agentName: { equals: n, mode: "insensitive" },
          })),
        },
        select: { agentName: true, agentId: true },
      })
    : [];
  const agentIdByName = new Map(
    aliases.map((a) => [a.agentName.trim().toLowerCase(), a.agentId]),
  );
  const unmatchedAgents = names
    .filter((n) => !agentIdByName.has(n.toLowerCase()))
    .sort();

  const toStore: RowToStore[] = unique.map(({ agentName, ...rest }) => ({
    ...rest,
    agentId: agentName ? (agentIdByName.get(agentName.trim().toLowerCase()) ?? null) : null,
  }));
  const upserted = toStore.length ? await upsertMapped(toStore) : 0;
  const openerRefresh = await refreshOpenerTransferLogs();

  return {
    fetched: raw.length,
    mapped: unique.length,
    upserted,
    skipped,
    unmatchedAgents,
    openerLogsChecked: openerRefresh.checked,
    openerLogsUpdated: openerRefresh.updated,
  };
}
