/**
 * Known 1099 contractors keyed by CRM "Sales Rep" spelling (case-insensitive).
 * Canonical source for tagging + future contractor vs employee Excel sheets.
 * Agent login profiles mirror this via employmentType / companyName when aliases match.
 */

import { agentIdentityKey } from "@/lib/commission/calculator";

export const CONTRACTOR_COMPANIES: Readonly<Record<string, string>> = {
  "alex tambouly": "M and A Financial Solutions LLC",
  "artin namjoo": "Aluna Consulting Group LLC",
  "peter godwin": "Wise Consulting",
  "amir moayeri": "Debt Free Consulting LLC",
};

export function isKnownContractor(agentName: string | null | undefined): boolean {
  return Boolean(CONTRACTOR_COMPANIES[agentIdentityKey(agentName || "")]);
}

export function contractorCompanyFor(
  agentName: string | null | undefined,
): string | null {
  return CONTRACTOR_COMPANIES[agentIdentityKey(agentName || "")] ?? null;
}

export type EmploymentInfo = {
  employmentType: "employee" | "contractor";
  companyName: string | null;
};

/** Resolve by CRM name first (known map), else optional profile override. */
export function resolveEmployment(
  agentName: string | null | undefined,
  profile?: { employmentType?: string | null; companyName?: string | null } | null,
): EmploymentInfo {
  const company = contractorCompanyFor(agentName);
  if (company) {
    return { employmentType: "contractor", companyName: company };
  }
  if (profile?.employmentType === "contractor") {
    return {
      employmentType: "contractor",
      companyName: profile.companyName?.trim() || null,
    };
  }
  return { employmentType: "employee", companyName: null };
}
