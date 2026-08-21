/**
 * Full-history CRM export → per-period commission results.
 * Faithful port of agent_portal/commission_core/crm_parser.py
 * Defaults match mycommish / agent_portal policy:
 *   persistSameMonthCancel=true
 *   requirePriorPaymentEvidence=false  (late activation OFF)
 *   requireClawbackPaymentEvidence=true
 */

import { parse as parseCsvSync } from "csv-parse/sync";
import {
  agentIdentityKey,
  calculateAgentCommission,
  calculateClawbackAmount,
  canonicalizeAgentNames,
  getFixedRate,
  paymentDateForPeriod,
  type AgentCommissionResult,
} from "./calculator";
import { applySalesRepOverrides } from "@/lib/claims/apply-sales-rep-overrides";

export const NSF_FLAG_THRESHOLD = 3;

export const CRM_REQUIRED_COLUMNS = new Set([
  "sales rep",
  "1st payment cleared date",
  "dropped date",
  "status",
  "enrolled debt",
  "# nsf",
]);

export type UnitStatus =
  | "cleared"
  | "pending"
  | "same_month_cancel"
  | "safe_cancel"
  | "clawback"
  | "not_yet_cleared";

export type CrmClient = {
  crmId: string;
  /** CRM "External ID" column — agents search by this. */
  externalId: string;
  agentName: string;
  clientName: string;
  email: string;
  phone: string;
  stage: string;
  status: string;
  submittedDate: string;
  enrolledDate: string;
  firstPaymentDate: string;
  firstPaymentClearedDate: string;
  secondPaymentClearedDate: string;
  droppedDate: string;
  payFreq: string;
  paymentsMade: number;
  nsfCount: number;
  enrolledDebt: number;
  creditScore: number | null;
  isLowCredit: boolean;
  unitStatus: UnitStatus;
  enrolledPeriod: string | null;
  clearedPeriod: string | null;
  droppedPeriod: string | null;
  isCleared: boolean;
  isPending: boolean;
  isCancelled: boolean;
  commissionOnClient: number;
  clawbackAmount: number;
  isLateActivation?: boolean;
  originalClearedPeriod?: string;
  _periodLabel?: string;
  _clawbackInPeriod?: string;
};

export type PeriodResult = AgentCommissionResult & {
  clawbackAmount: number;
  netCommission: number;
  nsfFlagged: boolean;
  pendingUnits: number;
  pendingDebt: number;
  source: string;
  _clearedClients?: CrmClient[];
  _allPeriodClients?: CrmClient[];
  _clawbackClients?: CrmClient[];
  _periodLabel?: string;
};

export type PeriodOutput = {
  periodLabel: string | null;
  filename: string;
  results: PeriodResult[];
  clientRows: CrmClient[];
  errors: string[];
  /** All CRM rows with an ID (incl. not-yet-cleared) for identity / lookup directory. */
  directoryClients?: CrmClient[];
};

export type KnownPeriodTotals = Record<
  string, // `${identityKey}::${periodLabel}`
  {
    unitsCleared: number;
    totalClearedDebt: number;
    grossCommission: number;
    cancellationRate: number;
  }
>;

export type ParseCrmOptions = {
  alreadyClearedCrmIds?: Set<string>;
  alreadyChargedBackCrmIds?: Set<string>;
  alreadyLowCreditCrmIds?: Set<string>;
  alreadyHistoryPaidCrmIds?: Set<string>;
  persistSameMonthCancel?: boolean;
  requirePriorPaymentEvidence?: boolean;
  requireClawbackPaymentEvidence?: boolean | null;
  knownPeriodTotals?: KnownPeriodTotals;
  knownEnrolledDebtByCrmId?: Record<string, number>;
  knownRateByCrmId?: Record<string, number>;
  /** Accepted file-claim assignments: External ID / CRM ID → Sales Rep. */
  salesRepOverrides?: Map<string, string> | Record<string, string>;
};

export function safePaymentThreshold(payFreq: string | null | undefined): number {
  const freq = (payFreq || "").trim().toLowerCase().replace(/-/g, "").replace(/ /g, "");
  if (freq === "biweekly" || freq === "semimonthly") return 4;
  if (freq === "monthly") return 2;
  return 3;
}

export function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const formats: Array<(s: string) => Date | null> = [
    (s) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s);
      if (!m) return null;
      const year = 2000 + Number(m[3]);
      return new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
    },
    (s) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
      if (!m) return null;
      return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
    },
    (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m) return null;
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    },
  ];
  for (const f of formats) {
    const d = f(v);
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function periodOf(dt: Date | null): string | null {
  if (!dt) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseCurrency(value: string): number {
  return Number.parseFloat(value.trim().replace(/\$/g, "").replace(/,/g, "") || "0") || 0;
}

/** Dropped Date holding the cents half of a comma-split Enrolled Debt (e.g. "664.62"). */
const SPLIT_DEBT_FRAGMENT = /^\d{1,3}\.\d{2}$/;

/**
 * Real CRM has Enrolled Debt immediately before Dropped Date. Unquoted values like
 * `$2,664.62` become debt=`$2` + dropped=`664.62`. Reassemble when that pattern appears.
 */
export function repairSplitEnrolledDebt(
  debtRaw: string,
  droppedRaw: string,
): { debt: number; droppedRaw: string; repaired: boolean } {
  const dropped = (droppedRaw || "").trim();
  const debt = parseCurrency(debtRaw);
  if (!SPLIT_DEBT_FRAGMENT.test(dropped)) {
    return { debt, droppedRaw: dropped, repaired: false };
  }
  // Fragment is not a real calendar date (no month/day structure).
  if (parseDate(dropped)) {
    return { debt, droppedRaw: dropped, repaired: false };
  }
  const dollarPart = debtRaw.replace(/[^\d]/g, "");
  if (!dollarPart) {
    return { debt, droppedRaw: dropped, repaired: false };
  }
  // "$2" + "664.62" → "2664.62"
  const assembled = Number.parseFloat(`${dollarPart}${dropped}`);
  if (!Number.isFinite(assembled) || assembled <= debt) {
    return { debt, droppedRaw: dropped, repaired: false };
  }
  return { debt: assembled, droppedRaw: "", repaired: true };
}

/** Events whose Dropped Date is clearly a currency fragment from a bad CSV split. */
export function isPoisonedDebtDroppedDate(droppedDate: string | null | undefined): boolean {
  const d = (droppedDate || "").trim();
  return SPLIT_DEBT_FRAGMENT.test(d) && !parseDate(d);
}


function zeroUnitHoldingResult(agentName: string): PeriodResult {
  return {
    agentName,
    unitsCleared: 0,
    totalClearedDebt: 0,
    cancellationRate: 0,
    hourlyDraw: 0,
    rawTier: 0,
    adjustedTier: 0,
    tierRate: 0,
    grossCommission: 0,
    clawbackAmount: 0,
    netCommission: 0,
    payout: 0,
    payoutType: "draw",
    qualityBonusEligible: false,
    cancellationPenaltyApplied: false,
    nsfFlagged: false,
    pendingUnits: 0,
    pendingDebt: 0,
    source: "crm",
    notes: "",
    _clearedClients: [],
    _allPeriodClients: [],
  };
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Use csv-parse (RFC-style) — our previous handmade splitter stripped quotes while
  // joining lines, so values like "$45,296.00" split across Enrolled Debt / Dropped Date
  // (those two columns are adjacent in the real CRM export).
  const records = parseCsvSync(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (!records.length) {
    // Still surface headers when the file has a header-only row
    const headerOnly = parseCsvSync(text, {
      columns: false,
      to_line: 1,
      relax_column_count: true,
      bom: true,
    }) as string[][];
    return { headers: headerOnly[0] ?? [], rows: [] };
  }

  const headers = Object.keys(records[0]);
  const rows = records.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = v == null ? "" : String(v);
    }
    return out;
  });
  return { headers, rows };
}

function knownTotalsKey(agentName: string, periodLabel: string): string {
  return `${agentIdentityKey(agentName)}::${periodLabel}`;
}

export function parseCrmAndCalculate(
  fileBytes: Uint8Array | Buffer | string,
  filename: string,
  options: ParseCrmOptions = {},
): PeriodOutput[] {
  // Defaults match agent_portal test helper / mycommish product policy for the
  // first two flags. requireClawbackPaymentEvidence: when omitted, falls back to
  // requirePriorPaymentEvidence (Python parity). Production ingest MUST pass
  // requireClawbackPaymentEvidence=true explicitly.
  const persistSameMonthCancel = options.persistSameMonthCancel ?? true;
  const requirePriorPaymentEvidence = options.requirePriorPaymentEvidence ?? false;
  let requireClawbackPaymentEvidence = options.requireClawbackPaymentEvidence;
  if (requireClawbackPaymentEvidence == null) {
    requireClawbackPaymentEvidence = requirePriorPaymentEvidence;
  }
  const alreadyClearedCrmIds = options.alreadyClearedCrmIds ?? new Set<string>();
  const alreadyChargedBackCrmIds = options.alreadyChargedBackCrmIds ?? new Set<string>();
  const alreadyLowCreditCrmIds = options.alreadyLowCreditCrmIds ?? new Set<string>();
  const alreadyHistoryPaidCrmIds = options.alreadyHistoryPaidCrmIds ?? new Set<string>();
  const knownPeriodTotals = options.knownPeriodTotals ?? {};
  const knownEnrolledDebtByCrmId = options.knownEnrolledDebtByCrmId ?? {};
  const knownRateByCrmId = options.knownRateByCrmId ?? {};

  let text: string;
  try {
    text =
      typeof fileBytes === "string"
        ? fileBytes.replace(/^\uFEFF/, "")
        : new TextDecoder("utf-8").decode(fileBytes).replace(/^\uFEFF/, "");
  } catch {
    return [{ errors: ["File must be UTF-8 encoded."], periodLabel: null, filename, results: [], clientRows: [] }];
  }

  const { headers, rows } = parseCsv(text);
  if (!headers.length) {
    return [{ errors: ["CSV file is empty or has no header row."], periodLabel: null, filename, results: [], clientRows: [] }];
  }

  const actualCols = new Set(headers.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const missing = [...CRM_REQUIRED_COLUMNS].filter((c) => !actualCols.has(c));
  if (missing.length) {
    return [
      {
        errors: [`Missing required CRM columns: ${missing.sort().join(", ")}`],
        periodLabel: null,
        filename,
        results: [],
        clientRows: [],
      },
    ];
  }

  const colMap = new Map<string, string>();
  for (const c of headers) {
    if (c) colMap.set(c.trim().toLowerCase(), c);
  }
  const get = (row: Record<string, string>, key: string) =>
    (row[colMap.get(key) ?? key] ?? "").trim();

  const allClients: CrmClient[] = [];
  const rowErrors: string[] = [];

  rows.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const agent = get(rawRow, "sales rep");
    if (!agent) {
      rowErrors.push(`Row ${rowNum}: missing Sales Rep, skipped`);
      return;
    }

    const droppedDateRaw0 = get(rawRow, "dropped date");
    const debtRaw = get(rawRow, "enrolled debt");
    const repaired = repairSplitEnrolledDebt(debtRaw, droppedDateRaw0);
    if (repaired.repaired) {
      rowErrors.push(
        `Row ${rowNum} (${agent}): repaired Enrolled Debt split across Dropped Date → $${repaired.debt.toFixed(2)}`,
      );
    }
    const droppedDateRaw = repaired.droppedRaw;
    const clearedDate = parseDate(get(rawRow, "1st payment cleared date"));
    const enrolledDate = parseDate(get(rawRow, "enrolled date"));
    const droppedDate = parseDate(droppedDateRaw);
    const status = get(rawRow, "status");

    let enrolledDebt = repaired.debt;
    if (!repaired.repaired) {
      try {
        enrolledDebt = parseCurrency(debtRaw);
      } catch {
        enrolledDebt = 0;
        rowErrors.push(`Row ${rowNum} (${agent}): invalid Enrolled Debt, using 0`);
      }
    }

    let nsfCount = 0;
    try {
      nsfCount = Number.parseInt(get(rawRow, "# nsf") || "0", 10) || 0;
    } catch {
      nsfCount = 0;
    }

    let paymentsMade = 0;
    try {
      paymentsMade = Number.parseInt(get(rawRow, "payments made") || "0", 10) || 0;
    } catch {
      paymentsMade = 0;
    }

    const payFreq = get(rawRow, "pay freq.");
    if (!payFreq.trim()) {
      rowErrors.push(
        `Row ${rowNum} (${agent}): Pay Freq. is blank — clawback threshold defaulted to 3, please review`,
      );
    }
    const safeThreshold = safePaymentThreshold(payFreq);
    const isPendingCancellation = status.trim().toLowerCase() === "pending affiliate cancellation";
    const enrolledPeriod = periodOf(enrolledDate);
    const clearedPeriod = periodOf(clearedDate);
    const droppedPeriod = periodOf(droppedDate);
    const sameMonth = Boolean(clearedPeriod && droppedPeriod && clearedPeriod === droppedPeriod);

    const paymentDate = clearedPeriod ? paymentDateForPeriod(clearedPeriod) : null;
    const droppedBeforePayment = Boolean(
      droppedDate && paymentDate && droppedDate.getTime() < paymentDate.getTime(),
    );

    let unitStatus: UnitStatus;
    if (clearedDate && !droppedDate && !isPendingCancellation) {
      unitStatus = "cleared";
    } else if (clearedDate && !droppedDate && isPendingCancellation) {
      unitStatus = paymentsMade >= safeThreshold ? "cleared" : "pending";
    } else if (clearedDate && droppedDate && sameMonth) {
      unitStatus = "same_month_cancel";
    } else if (clearedDate && droppedDate && !sameMonth && paymentsMade >= safeThreshold) {
      unitStatus = "safe_cancel";
    } else if (clearedDate && droppedDate && !sameMonth && droppedBeforePayment) {
      unitStatus = "same_month_cancel";
    } else if (clearedDate && droppedDate && !sameMonth) {
      unitStatus = "clawback";
    } else {
      unitStatus = "not_yet_cleared";
      // Keep never-cleared rows when Enrolled Date is present — they belong in the
      // enrollment-month cancel-rate cohort (owner policy). Still skip blank rows.
      if (!clearedDate && !enrolledPeriod) return;
    }

    const creditScoreRaw = get(rawRow, "credit score");
    let creditScore: number | null = null;
    if (creditScoreRaw) {
      const n = Number.parseFloat(creditScoreRaw);
      creditScore = Number.isFinite(n) ? Math.trunc(n) : null;
    }
    const isLowCredit = creditScore !== null && creditScore < 500;

    allClients.push({
      crmId: get(rawRow, "id"),
      externalId: get(rawRow, "external id"),
      agentName: agent,
      clientName: get(rawRow, "full name"),
      email: get(rawRow, "email"),
      phone: get(rawRow, "home phone"),
      stage: get(rawRow, "stage"),
      status,
      submittedDate: get(rawRow, "submitted date"),
      enrolledDate: get(rawRow, "enrolled date"),
      firstPaymentDate: get(rawRow, "1st payment date"),
      firstPaymentClearedDate: get(rawRow, "1st payment cleared date"),
      secondPaymentClearedDate: get(rawRow, "2nd payment cleared date"),
      // Only persist a real date string — never a currency fragment from a bad CSV split
      droppedDate: droppedDate ? droppedDateRaw : "",
      payFreq,
      paymentsMade,
      nsfCount,
      enrolledDebt,
      creditScore,
      isLowCredit,
      unitStatus,
      enrolledPeriod,
      clearedPeriod,
      droppedPeriod,
      isCleared: unitStatus === "cleared",
      isPending: unitStatus === "pending",
      isCancelled: droppedDate !== null,
      commissionOnClient: 0,
      clawbackAmount: 0,
    });
  });

  canonicalizeAgentNames(allClients);

  // Manager/admin accepted claims stick across CRM re-uploads.
  applySalesRepOverrides(allClients, options.salesRepOverrides);

  const allClearedPeriods = allClients.map((c) => c.clearedPeriod).filter(Boolean) as string[];
  const latestPeriodInFile = allClearedPeriods.length ? allClearedPeriods.reduce((a, b) => (a > b ? a : b)) : null;

  if (requirePriorPaymentEvidence && alreadyClearedCrmIds.size > 0) {
    for (const c of allClients) {
      if (
        c.unitStatus === "cleared" &&
        c.crmId &&
        !alreadyClearedCrmIds.has(c.crmId) &&
        c.clearedPeriod &&
        latestPeriodInFile &&
        c.clearedPeriod < latestPeriodInFile
      ) {
        c.originalClearedPeriod = c.clearedPeriod;
        c.clearedPeriod = latestPeriodInFile;
        c.isLateActivation = true;
      }
    }
  }

  type Key = string;
  const keyOf = (agent: string, period: string | null) => `${agent}|||${period}`;

  const clearedBuckets = new Map<Key, CrmClient[]>();
  const cancelBuckets = new Map<Key, CrmClient[]>();
  const pendingBuckets = new Map<Key, CrmClient[]>();
  const safeCancelBuckets = new Map<Key, CrmClient[]>();
  const sameMonthCancelBuckets = new Map<Key, CrmClient[]>();
  const alreadyPaidSkipped: CrmClient[] = [];

  const push = (map: Map<Key, CrmClient[]>, k: Key, c: CrmClient) => {
    const arr = map.get(k) ?? [];
    arr.push(c);
    map.set(k, arr);
  };

  for (const c of allClients) {
    const k = keyOf(c.agentName, c.clearedPeriod);
    const alreadyHistoryPaid = Boolean(c.crmId) && alreadyHistoryPaidCrmIds.has(c.crmId);
    if (c.unitStatus === "cleared") {
      if (alreadyHistoryPaid) {
        alreadyPaidSkipped.push(c);
        continue;
      }
      push(clearedBuckets, k, c);
    } else if (c.unitStatus === "same_month_cancel") {
      push(sameMonthCancelBuckets, k, c);
    } else if (c.unitStatus === "safe_cancel") {
      if (alreadyHistoryPaid) {
        alreadyPaidSkipped.push(c);
        continue;
      }
      push(safeCancelBuckets, k, c);
    } else if (c.unitStatus === "clawback") {
      push(cancelBuckets, k, c);
    } else if (c.unitStatus === "pending") {
      push(pendingBuckets, k, c);
    }
  }

  if (alreadyPaidSkipped.length) {
    const names = alreadyPaidSkipped
      .slice(0, 10)
      .map((c) => `${c.clientName || c.crmId} (${c.agentName}, ${c.clearedPeriod})`)
      .join(", ");
    const more =
      alreadyPaidSkipped.length > 10 ? ` and ${alreadyPaidSkipped.length - 10} more` : "";
    rowErrors.push(
      `${alreadyPaidSkipped.length} client(s) already paid via a Commission History import — not recalculated (still watched for a future clawback if they drop): ${names}${more}`,
    );
  }

  const agentPeriodResults = new Map<Key, PeriodResult>();
  const tierKeys = new Set([...clearedBuckets.keys(), ...safeCancelBuckets.keys()]);

  for (const k of tierKeys) {
    const [agentName, periodLabel] = k.split("|||");
    const cleared = clearedBuckets.get(k) ?? [];
    const safeCancels = safeCancelBuckets.get(k) ?? [];
    const cancelled = cancelBuckets.get(k) ?? [];
    const pending = pendingBuckets.get(k) ?? [];
    const sameMonthCancels = persistSameMonthCancel ? sameMonthCancelBuckets.get(k) ?? [] : [];

    const tierUnits = [...cleared, ...safeCancels];
    const unitsCleared = tierUnits.length;
    const lowCreditClients = tierUnits.filter((c) => c.isLowCredit);
    // Safe cancels (payment threshold met) earn full commission — Cordoba will not
    // charge them back. Only low-credit units stay at $0 debt/commission.
    const totalClearedDebt = tierUnits
      .filter((c) => !c.isLowCredit)
      .reduce((s, c) => s + c.enrolledDebt, 0);
    // OWNER POLICY: cancel rate = enrollments in this commission month that have a
    // Dropped Date / enrollments in this commission month (CRM Enrolled Date).
    // Cleared / clawback / same-month / safe / pending status does not change the
    // cohort — only Enrolled Date month and whether Dropped Date is present.
    const enrolledInPeriod = allClients.filter(
      (c) => c.agentName === agentName && c.enrolledPeriod === periodLabel,
    );
    const droppedAmongEnrolled = enrolledInPeriod.filter((c) => Boolean(c.droppedDate));
    const cancelRatePct =
      enrolledInPeriod.length > 0
        ? (droppedAmongEnrolled.length / enrolledInPeriod.length) * 100
        : 0;
    const nsfFlagged = [...tierUnits, ...cancelled, ...pending].some(
      (c) => c.nsfCount >= NSF_FLAG_THRESHOLD,
    );

    const base = calculateAgentCommission({
      agentName,
      unitsCleared,
      totalClearedDebt,
      cancellationRatePct: cancelRatePct,
      hourlyDraw: 0,
    });

    const result: PeriodResult = {
      ...base,
      clawbackAmount: 0,
      netCommission: base.grossCommission,
      nsfFlagged,
      pendingUnits: pending.length,
      pendingDebt: pending.reduce((s, c) => s + c.enrolledDebt, 0),
      source: "crm",
      _clearedClients: tierUnits,
      _allPeriodClients: [...tierUnits, ...cancelled, ...pending, ...sameMonthCancels],
    };

    if (pending.length > 0) {
      result.notes += ` | ${pending.length} unit(s) pending Affiliate Cancellation review`;
    }
    if (nsfFlagged) {
      result.notes += ` | NSF flag: client(s) with ${NSF_FLAG_THRESHOLD}+ NSF events`;
    }
    if (lowCreditClients.length) {
      result.notes += ` | ${lowCreditClients.length} unit(s) counted at $0 commission (Credit Score < 500)`;
    }
    if (safeCancels.length) {
      result.notes += ` | ${safeCancels.length} safe cancel unit(s) commissioned (payment threshold met — no Cordoba clawback)`;
    }
    const lateActivations = tierUnits.filter((c) => c.isLateActivation);
    if (lateActivations.length) {
      const periods = [...new Set(lateActivations.map((c) => c.originalClearedPeriod!))].sort();
      result.notes += ` | ${lateActivations.length} late activation(s) — originally cleared ${periods.join(", ")}, commission credited this period`;
    }

    for (const c of tierUnits) {
      c.commissionOnClient = c.isLowCredit
        ? 0
        : Math.round(c.enrolledDebt * result.tierRate * 100) / 100;
    }

    agentPeriodResults.set(k, result);
    void periodLabel;
  }

  const clawbackByTarget = new Map<Key, CrmClient[]>();
  const reclassifiedClients: CrmClient[] = [];

  for (const c of allClients) {
    if (c.unitStatus !== "clawback") continue;

    const crmId = c.crmId || "";
    const agentName = c.agentName;
    const clearedPeriod = c.clearedPeriod;
    const targetPeriod = c.droppedPeriod;
    const origKey = keyOf(agentName, clearedPeriod);

    if (crmId && crmId in knownEnrolledDebtByCrmId) {
      const known = knownEnrolledDebtByCrmId[crmId];
      // History / prior clear may raise debt (original enrolled). Never let a
      // truncated poison known ($2 from CSV split) shrink a plausible file debt.
      if (known > c.enrolledDebt) {
        c.enrolledDebt = known;
      }
    }

    if (crmId && alreadyChargedBackCrmIds.has(crmId)) continue;

    if (requireClawbackPaymentEvidence) {
      const wasClearedInFile = (clearedBuckets.get(origKey) ?? []).some((x) => x.crmId === crmId);
      const wasPaidInDb = Boolean(crmId && alreadyClearedCrmIds.has(crmId));
      if (!wasClearedInFile && !wasPaidInDb) {
        c.unitStatus = "same_month_cancel";
        c.isCancelled = true;
        reclassifiedClients.push(c);
        continue;
      }
    }

    if (c.isLowCredit || (crmId && alreadyLowCreditCrmIds.has(crmId))) {
      c.unitStatus = "same_month_cancel";
      c.isCancelled = true;
      reclassifiedClients.push(c);
      continue;
    }

    const knownRate = crmId ? knownRateByCrmId[crmId] : undefined;
    if (knownRate != null) {
      const cb = Math.round(c.enrolledDebt * knownRate * 100) / 100;
      c.clawbackAmount = cb;
      push(clawbackByTarget, keyOf(agentName, targetPeriod), c);
      continue;
    }

    const known = knownPeriodTotals[knownTotalsKey(agentName, clearedPeriod!)];
    const origResult = known
      ? {
          unitsCleared: known.unitsCleared,
          totalClearedDebt: known.totalClearedDebt,
          grossCommission: known.grossCommission,
          cancellationRate: known.cancellationRate,
        }
      : agentPeriodResults.get(origKey);

    if (!origResult) {
      const fallbackRate = getFixedRate(agentName) || 0.01;
      c.clawbackAmount = Math.round(c.enrolledDebt * fallbackRate * 100) / 100;
      push(clawbackByTarget, keyOf(agentName, targetPeriod), c);
      continue;
    }

    const cb = calculateClawbackAmount(
      origResult.unitsCleared,
      origResult.totalClearedDebt,
      origResult.grossCommission,
      origResult.cancellationRate,
      c.enrolledDebt,
      agentName,
    );
    c.clawbackAmount = cb;
    push(clawbackByTarget, keyOf(agentName, targetPeriod), c);
  }

  for (const c of reclassifiedClients) {
    const k = keyOf(c.agentName, c.clearedPeriod);
    if (agentPeriodResults.has(k)) continue;
    const pending = pendingBuckets.get(k) ?? [];
    const cancelled = (cancelBuckets.get(k) ?? []).filter((x) => x.unitStatus !== "clawback");
    const result = zeroUnitHoldingResult(c.agentName);
    result.pendingUnits = pending.length;
    result.pendingDebt = pending.reduce((s, x) => s + x.enrolledDebt, 0);
    const sameMonthCancels = persistSameMonthCancel ? sameMonthCancelBuckets.get(k) ?? [] : [];
    result._allPeriodClients = [...cancelled, ...pending, ...sameMonthCancels];
    agentPeriodResults.set(k, result);
  }

  for (const [k, cbClients] of clawbackByTarget) {
    const totalCb = Math.round(cbClients.reduce((s, c) => s + c.clawbackAmount, 0) * 100) / 100;
    const [agentName] = k.split("|||");
    if (!agentPeriodResults.has(k)) {
      agentPeriodResults.set(k, zeroUnitHoldingResult(agentName));
    }
    const r = agentPeriodResults.get(k)!;
    r.clawbackAmount = Math.round((r.clawbackAmount + totalCb) * 100) / 100;
    r.netCommission = Math.max(0, Math.round((r.grossCommission - r.clawbackAmount) * 100) / 100);
    r.notes =
      (r.notes || "") +
      ` | Clawback -$${totalCb.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${cbClients.length} previously-paid cancelled client(s)`;
    r._clawbackClients = cbClients;
  }

  const periodMap = new Map<string, PeriodResult[]>();
  for (const [k, result] of agentPeriodResults) {
    const periodLabel = k.split("|||")[1];
    result._periodLabel = periodLabel;
    const arr = periodMap.get(periodLabel) ?? [];
    arr.push(result);
    periodMap.set(periodLabel, arr);
  }

  const periodsOut: PeriodOutput[] = [];
  for (const periodLabel of [...periodMap.keys()].sort()) {
    const agentResults = periodMap.get(periodLabel)!;
    const periodClientRows: CrmClient[] = [];
    for (const r of agentResults) {
      for (const c of r._allPeriodClients ?? []) {
        c._periodLabel = periodLabel;
        periodClientRows.push(c);
      }
      for (const c of r._clawbackClients ?? []) {
        c._clawbackInPeriod = periodLabel;
        periodClientRows.push(c);
      }
    }
    periodsOut.push({
      periodLabel,
      filename,
      results: agentResults,
      clientRows: periodClientRows,
      errors: rowErrors,
    });
  }

  if (!periodsOut.length) {
    periodsOut.push({
      periodLabel: null,
      filename,
      results: [],
      clientRows: [],
      errors: [...rowErrors, "No commissionable rows found in file."],
    });
  }

  // Full CRM directory (incl. enrolled / not-yet-cleared) for identity + agent file lookup.
  const directoryClients = allClients.filter((c) => Boolean(c.crmId));
  if (periodsOut.length) {
    periodsOut[0].directoryClients = directoryClients;
  }

  return periodsOut;
}

/** Build CSV bytes for tests. */
export function crmCsv(
  rows: Array<Record<string, string>>,
  headers = [
    "ID",
    "Sales Rep",
    "Full Name",
    "Enrolled Date",
    "1st Payment Cleared Date",
    "Dropped Date",
    "Status",
    "Enrolled Debt",
    "# NSF",
    "Payments Made",
    "Pay Freq.",
    "Credit Score",
  ],
): string {
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function clientRow(
  crmId: string,
  opts: Partial<Record<string, string>> & {
    enrolled?: string;
    cleared?: string;
    dropped?: string;
    status?: string;
    debt?: string;
    payments?: string;
    freq?: string;
    rep?: string;
    name?: string;
    nsf?: string;
    creditScore?: string;
  } = {},
): Record<string, string> {
  // Default Enrolled Date to cleared month (or dropped month) so cancel-rate
  // tests that omit `enrolled` still exercise the enrollment-month cohort.
  const enrolled =
    opts.enrolled ??
    opts.cleared ??
    (opts.dropped ? opts.dropped : "");
  return {
    ID: crmId,
    "Sales Rep": opts.rep ?? "Maria",
    "Full Name": opts.name ?? "Client",
    "Enrolled Date": enrolled,
    "1st Payment Cleared Date": opts.cleared ?? "",
    "Dropped Date": opts.dropped ?? "",
    Status: opts.status ?? "Active",
    "Enrolled Debt": opts.debt ?? "10000",
    "# NSF": opts.nsf ?? "0",
    "Payments Made": opts.payments ?? "0",
    "Pay Freq.": opts.freq ?? "Monthly",
    "Credit Score": opts.creditScore ?? "",
  };
}
