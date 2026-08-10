# mycommish

Greenfield rebuild of the ADP agent commission portal ([mycommish.app](https://mycommish.app)).

**Sibling of** `Comission_ADP` — does not modify that repo. Business rules (tiers, clawbacks, Cordoba gates, history Rate) stay the same; architecture does not.

## v1 scope (locked)

| Source | How |
|---|---|
| CRM | Manual upload |
| Cordoba | Manual `.xlsx` |
| History | Manual ledger upload |
| BigQuery | **Not in v1** |

- Agents: Google/password login, **latest 2 `calculated` periods only**, own aliases only
- Periods: `calculated` vs `history` may share a month; agents never see history as “owed”
- **Lock after payday** (25th of next month): no rewrite of units/gross on closed periods
- **Clawbacks allowed on closed periods** (Cordoba can arrive late)
- Money: immutable **LedgerEntry** + cached `AgentPeriod` rollup
- Cordoba placement: paid evidence + **any** own `dropped_date` for that `crm_id`

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- Pure commission engine in `src/lib/commission/` (no DB deps)

## Setup

1. Copy env and set secrets:

```bash
cp .env.example .env
# DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
```

2. Install + migrate + seed your admin Google email:

```bash
npm install
npm run db:generate
npm run db:migrate
npx tsx scripts/seed-admin.ts you@company.com "Your Name"
```

3. Google Cloud Console: OAuth client with redirect  
`http://localhost:3000/api/auth/callback/google` (and your prod URL later).

4. Run:

```bash
npm run dev            # http://localhost:3000
npm test               # commission math
```

## Layout

```
prisma/schema.prisma              # locked data model
src/lib/commission/calculator.ts  # tiers / clawback math
src/lib/commission/crm-parser.ts  # full-history CRM → periods
src/lib/ingest/crm.ts             # save to Neon (ledger + lock-after-pay)
src/app/admin/                    # uploads + ops (next)
src/app/portal/                   # agent-facing (next)
```

## Invariants (do not “fix” without owner sign-off)

1. Tier table: 1–20 / 21–31 / 32–39 / 40–45 / 46–60 / 61+
2. Cancel rate > 20% drops one tier; exactly 20% does not
3. Alex Tambouly 2%, Peter Godwin 1.75% fixed — no tier penalty
4. Clawbacks land in the client’s own dropped month
5. Cordoba never uses the Chargebacks file’s Dropped Date / debt for math
6. History-paid clients: clawback = `enrolled_debt × paid_rate` when Rate known
