import { agentIdentityKey } from "@/lib/commission/calculator";
import { contractorCompanyFor } from "@/lib/agents/contractors";
import rosterData from "./roster-data.json";

export type EmployeeRosterRow = {
  lastName: string;
  firstName: string;
  title: string;
  gustoEmployeeId: string;
  regularHours: string;
};

export type ContractorRosterRow = {
  lastName: string;
  firstName: string;
  businessName: string;
  ein: string;
  hourlyRate: string;
};

const employees = rosterData.employees as EmployeeRosterRow[];
const contractors = rosterData.contractors as ContractorRosterRow[];

/**
 * CRM / portal Sales Rep spelling → Gusto timesheet legal name key ("first last").
 * Legal first/last always come from the Gusto roster row, never CRM spelling.
 */
const EMPLOYEE_NAME_ALIASES: Record<string, string> = {
  "aj valipour": "amirarsalan valipour",
  "amir arsalan valipour": "amirarsalan valipour",
  "amirarsalan valipour": "amirarsalan valipour",
  "big dawg don bell": "bigdawgdon bell",
  "don bell": "bigdawgdon bell",
  "bigdawgdon bell": "bigdawgdon bell",
  "abed al serwan": "abdul el serwan",
  "abdul al serwan": "abdul el serwan",
  "abed el serwan": "abdul el serwan",
  "el serwan abdul": "abdul el serwan",
  "siavash baghalian": "siavash baghalian zadeh",
  "siavash baghalian-zadeh": "siavash baghalian zadeh",
  "tyler mason": "siavash baghalian zadeh",
  "toha serwan": "tom elserwan",
  "toha elserwan": "tom elserwan",
  "paul simms": "paul sims",
  "alex wahlberg": "alexander wahlberg",
  "alexander wahlberg": "alexander wahlberg",
  "alex tulkoff": "alexander tulkoff",
  "shannon arman": "shannon arman",
  "jaiden lopez": "jaiden lopez",
};

function fullKey(first: string, last: string) {
  return agentIdentityKey(`${first} ${last}`);
}

function tokens(s: string): string[] {
  return agentIdentityKey(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const employeeByFullName = new Map<string, EmployeeRosterRow>();
for (const row of employees) {
  employeeByFullName.set(fullKey(row.firstName, row.lastName), row);
  employeeByFullName.set(fullKey(row.lastName, row.firstName), row);
}

const contractorByBusiness = new Map<string, ContractorRosterRow>();
for (const row of contractors) {
  if (row.businessName) {
    contractorByBusiness.set(agentIdentityKey(row.businessName), row);
  }
}

export function splitPersonName(agentName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = (agentName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/** Resolve CRM agentName → Gusto legal-name roster row. */
export function findEmployeeRoster(agentName: string): EmployeeRosterRow | null {
  const key = agentIdentityKey(agentName);
  const aliasTarget = EMPLOYEE_NAME_ALIASES[key];
  if (aliasTarget && employeeByFullName.has(aliasTarget)) {
    return employeeByFullName.get(aliasTarget)!;
  }
  if (employeeByFullName.has(key)) return employeeByFullName.get(key)!;

  const { firstName, lastName } = splitPersonName(agentName);
  const direct = employeeByFullName.get(fullKey(firstName, lastName));
  if (direct) return direct;

  const crmTokens = new Set(tokens(agentName));
  if (crmTokens.size >= 2) {
    const tokenHits = employees.filter((e) => {
      const legal = new Set([...tokens(e.firstName), ...tokens(e.lastName)]);
      // every CRM token appears in legal name (handles "Abed Al Serwan" ≈ "Abdul El Serwan" poorly;
      // require last-name token overlap + at least one first-name token overlap)
      const lastToks = tokens(e.lastName);
      const firstToks = tokens(e.firstName);
      const lastHit = lastToks.some((t) => crmTokens.has(t));
      const firstHit = firstToks.some((t) => crmTokens.has(t));
      return lastHit && firstHit && e.gustoEmployeeId;
    });
    if (tokenHits.length === 1) return tokenHits[0];
  }

  const lastKey = agentIdentityKey(lastName);
  const lastMatches = employees.filter(
    (e) => agentIdentityKey(e.lastName) === lastKey && e.gustoEmployeeId,
  );
  if (lastMatches.length === 1) return lastMatches[0];

  // Compound last names: CRM "Baghalian" vs legal "Baghalian Zadeh"
  const lastContains = employees.filter((e) => {
    const legalLast = agentIdentityKey(e.lastName);
    return (
      e.gustoEmployeeId &&
      (legalLast.includes(lastKey) || lastKey.includes(legalLast.split(" ")[0] || ""))
    );
  });
  if (lastContains.length === 1) {
    const firstKey = agentIdentityKey(firstName.split(/\s+/)[0] || "");
    if (
      !firstKey ||
      agentIdentityKey(lastContains[0].firstName).startsWith(firstKey) ||
      firstKey.startsWith(agentIdentityKey(lastContains[0].firstName))
    ) {
      return lastContains[0];
    }
  }

  return null;
}

export function findContractorRoster(
  agentName: string,
  companyName?: string | null,
): ContractorRosterRow | null {
  const company = companyName || contractorCompanyFor(agentName);
  if (company) {
    const hit = contractorByBusiness.get(agentIdentityKey(company));
    if (hit) return hit;
  }
  return null;
}

/** Title-case a CRM name token for contractor person fields when no better source. */
export function titleCaseName(name: string): string {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
