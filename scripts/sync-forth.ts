/**
 * Pull Forth contact list into Neon.
 *
 *   npx tsx scripts/sync-forth.ts
 *
 * Needs FORTH_API_KEY, FORTH_LIST_ID, DATABASE_URL.
 */

import "dotenv/config";
import { syncForthContacts } from "../src/lib/forth/sync";

async function main() {
  const result = await syncForthContacts();
  console.log(
    JSON.stringify({
      fetched: result.fetched,
      mapped: result.mapped,
      upserted: result.upserted,
      skipped: result.skipped,
      transferAgentsResolved: result.transferAgentsResolved,
      unmatchedCount: result.unmatchedAgents.length,
      unmatchedSample: result.unmatchedAgents.slice(0, 15),
      openerLogsChecked: result.openerLogsChecked,
      openerLogsUpdated: result.openerLogsUpdated,
    }),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
