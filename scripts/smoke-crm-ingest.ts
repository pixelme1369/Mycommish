import "dotenv/config";
import { ingestCrmUpload } from "../src/lib/ingest/crm";

async function main() {
  const csv = `ID,Sales Rep,Full Name,1st Payment Cleared Date,Dropped Date,Status,Enrolled Debt,# NSF,Payments Made,Pay Freq.,Credit Score
A1,Maria,Alice,06/10/26,,Active,20000,0,0,Monthly,
A2,Maria,Bob,06/12/26,,Active,30000,0,0,Monthly,
A3,Maria,Carol,06/12/26,08/03/26,Active,10000,0,1,Monthly,
`;
  const summary = await ingestCrmUpload(csv, "smoke-test.csv");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
