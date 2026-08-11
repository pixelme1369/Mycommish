# mycommish engineering notes

## Product invariants

See root README. Do not change tier / clawback / Cordoba / history Rate policy without owner sign-off.

## Architecture

- `LedgerEntry` is authoritative for dollars; `AgentPeriod` is a cached rollup recomputed on writes.
- Undo an upload by writing `reversal` ledger rows — never orphan Cordoba state.
- Agent queries: `CommissionPeriod.source = calculated`, latest 2 `periodLabel`s, alias-scoped `agentName`.
- **IDs:** ADP CRM `External ID` === Cordoba `ID` (agent-facing). Ledger/`ClientEvent` use CRM `ID` as `crmId`; Cordoba ingest resolves via `ClientIdentity.externalId`.

## Next build slices

1. ~~Port CRM classifier + parsers~~ (done — parity tests in vitest)
2. ~~CRM upload + UploadBatch skip reasons~~ (done — admin CRM upload)
3. ~~Auth (password; Google optional) + admin gate~~ (done)
4. ~~Admin + agent period detail UI~~ (done — `/admin/periods/[id]`, portal client tables)
5. ~~Cordoba ingest using ClientIdentity drop lookup~~ (done — any-event droppedDate; admin upload)
6. ~~History ledger upload~~ (done — parser + ingest + admin upload; Rate → paidRate)
7. ~~Richer admin ops~~ (done — upload order, close period, upload batch detail)
8. ~~Portal Cordoba polish~~ (done — Cordoba Payout on cleared; Charge back Yes/No + $0 snapshot merge on clawbacks)
9. ~~Admin history period detail~~ (done — `/admin/history/[id]` + agent clients with paidRate)

## Upload order (admin)

1. **History** (optional backfill) — anti-double-pay + `paidRate`
2. **CRM** — calculated periods + our dropped dates
3. **Cordoba** last — chargebacks need CRM clears/drops

Re-upload Cordoba after a later CRM if chargebacks were skipped for “not commissioned” / “no dropped date”.
