import { parseDate } from "@/lib/commission/crm-parser";
import { pacificTodayYmd, ymdFromParsed } from "@/lib/portal/daily-tasks-dates";

const PACIFIC = "America/Los_Angeles";

const SENSITIVE_KEYS = new Set([
  "ssn",
  "socialsecurity",
  "socialsecuritynumber",
  "dob",
  "dateofbirth",
  "birthdate",
  "email",
  "phone",
  "phonenumber",
  "cellphone",
  "mobile",
  "address",
  "zip",
  "zipcode",
  "creditscore",
  "ein",
]);

export type MappedForthContact = {
  forthId: string;
  /** Forth assigned_to — used to resolve agentId, also stored as assignedTo. */
  agentName: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  status: string | null;
  enrolledAmount: number;
  enrolledDate: Date | null;
  submittedDate: Date | null;
  assignedTo: string | null;
  tpId: string | null;
  stageTitle: string | null;
  contactType: string | null;
  leadStatusId: string | null;
  timeInStatus: string | null;
  inactiveDays: number | null;
  campaignId: string | null;
  lastCreditPulledDate: Date | null;
  droppedDate: Date | null;
  source: string | null;
  state: string | null;
  programStartDate: Date | null;
  forthCreatedAt: Date | null;
};

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function flattenCustomFields(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isPlainObject(item)) continue;
      const name =
        item.field_name ??
        item.fieldName ??
        item.name ??
        item.label ??
        item.key;
      const value = item.value ?? item.field_value ?? item.fieldValue;
      if (typeof name === "string" && name.trim()) out[name] = value;
    }
    return out;
  }
  if (isPlainObject(raw)) return raw;
  return out;
}

/** Flatten a Forth contact + custom_fields into a lookup keyed by normalized names. */
export function flattenContact(raw: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (!isPlainObject(raw)) return map;

  const layers: Record<string, unknown>[] = [raw];
  for (const nestKey of ["contact", "data", "attributes", "fields"]) {
    const nested = raw[nestKey];
    if (isPlainObject(nested)) layers.push(nested);
  }
  layers.push(flattenCustomFields(raw.custom_fields ?? raw.customFields));
  if (Array.isArray(raw.customs)) {
    const customLayer: Record<string, unknown> = {};
    for (const item of raw.customs) {
      if (!isPlainObject(item)) continue;
      const label = asString(item.label ?? item.name);
      const fieldId = asString(item.field_id ?? item.fieldId);
      if (label) customLayer[label] = item.value;
      if (fieldId) {
        const key = /^c\d+$/i.test(fieldId) ? fieldId : `c${fieldId}`;
        customLayer[key] = item.value;
      }
    }
    layers.push(customLayer);
  }

  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      const nk = normKey(k);
      if (!nk || SENSITIVE_KEYS.has(nk)) continue;
      if (v === undefined || v === null) continue;
      if (!map.has(nk)) map.set(nk, v);
    }
  }

  const assigned = raw.assigned_user ?? raw.assignedUser ?? raw.user;
  if (isPlainObject(assigned)) {
    const name =
      assigned.full_name ??
      assigned.fullName ??
      assigned.name ??
      [assigned.first_name, assigned.last_name].filter(Boolean).join(" ");
    if (name && !map.has("agent")) map.set("agent", name);
  }

  return map;
}

function pick(map: Map<string, unknown>, aliases: string[]): unknown {
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

export function parseMoney(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = asString(v);
  if (!s) return 0;
  const n = Number.parseFloat(s.replace(/\$/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function asInt(v: unknown): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function ymdFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function pacificParts(d: Date): {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const n = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    y: n("year"),
    m: n("month"),
    d: n("day"),
    h: n("hour"),
    min: n("minute"),
    s: n("second"),
  };
}

/** Forth naive `YYYY-MM-DD HH:mm:ss` is company local time (Pacific), not UTC. */
export function parsePacificDateTime(v: unknown): Date | null {
  const s = asString(v);
  if (!s) return null;

  if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : new Date(ms);
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6] || 0);
  let utc = Date.UTC(y, mo - 1, d, h, min, sec);
  for (let i = 0; i < 4; i++) {
    const got = pacificParts(new Date(utc));
    const gotUtc = Date.UTC(got.y, got.m - 1, got.d, got.h, got.min, got.s);
    const wantUtc = Date.UTC(y, mo - 1, d, h, min, sec);
    const delta = wantUtc - gotUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

/** Date-only values become midnight Pacific; datetimes use parsePacificDateTime. */
export function parsePacificDateOrDateTime(v: unknown): Date | null {
  const timed = parsePacificDateTime(v);
  if (timed) return timed;
  const ymd = toYmd(v);
  if (!ymd) return null;
  return parsePacificDateTime(`${ymd} 00:00:00`);
}

/** Clock time in America/Los_Angeles (PDT/PST), for admin/portal display. */
export function formatPacificDateTime(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** Calendar YYYY-MM-DD in Pacific. Date-only strings stay as the stated day. */
export function toYmd(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;

  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoDay) return s;

  const zoned = parsePacificDateTime(s);
  if (zoned) return ymdFromInstant(zoned);

  const parsed = parseDate(s);
  if (parsed) return ymdFromParsed(parsed);

  return null;
}

export function monthPrefix(ymd: string | null | undefined): string | null {
  if (!ymd || ymd.length < 7) return null;
  return ymd.slice(0, 7);
}

export function pacificMonthLabel(now = new Date()): string {
  return pacificTodayYmd(now).slice(0, 7);
}

export function mapForthContact(raw: unknown): MappedForthContact | null {
  const map = flattenContact(raw);
  const id = asString(
    pick(map, ["id", "contact_id", "contactId", "forth_contact_id", "forthId", "file_id"]),
  );
  if (!id) return null;

  const submittedDate =
    parsePacificDateTime(
      pick(map, ["submitted_at", "submitted at", "submitted_date", "submission date"]),
    ) ??
    parsePacificDateOrDateTime(
      pick(map, ["submission date", "submitted_at", "submitted_date", "submission_date"]),
    );
  const enrolledDate =
    parsePacificDateOrDateTime(
      pick(map, [
        "enrolled_date",
        "enrollment date",
        "enrolled date",
        "enrolled_at",
        "c772033",
        "Cordoba Enrolled Date",
        "cordoba enrolled date",
      ]),
    ) ??
    parsePacificDateOrDateTime(pick(map, ["issued date", "issued_at", "issued_date"]));

  const fullname = asString(pick(map, ["fullname", "full_name", "name"]));
  let clientFirstName = asString(pick(map, ["first name", "first_name"]));
  let clientLastName = asString(pick(map, ["last name", "last_name"]));
  if (!clientFirstName && !clientLastName && fullname) {
    if (fullname.includes(",")) {
      const [last, ...rest] = fullname.split(",");
      clientLastName = last.trim() || null;
      clientFirstName = rest.join(",").trim() || null;
    } else {
      const parts = fullname.split(/\s+/);
      clientFirstName = parts[0] ?? null;
      clientLastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    }
  }

  const assignedTo = asString(
    pick(map, [
      "agent",
      "assigned_to",
      "sales_rep",
      "salesrep",
      "assigned_user_name",
      "assigned_user",
      "owner",
    ]),
  );

  return {
    forthId: id,
    agentName: assignedTo,
    clientFirstName,
    clientLastName,
    status: asString(
      pick(map, [
        "leadTitle",
        "lead_title",
        "status_label",
        "status",
        "leadstatus",
        "lead_status",
      ]),
    ),
    enrolledAmount: parseMoney(
      pick(map, [
        "enrolled_debt",
        "enrolled debt",
        "total_debt",
        "annual premium",
        "annual_premium",
      ]),
    ),
    enrolledDate,
    submittedDate,
    assignedTo,
    tpId: asString(pick(map, ["tp_id", "tpId"])),
    stageTitle: asString(
      pick(map, ["stageTitle", "stage_title", "stage", "sub status", "sub_status"]),
    ),
    contactType: asString(pick(map, ["c_type", "contact_type", "contactType"])),
    leadStatusId: asString(pick(map, ["leadstatus", "lead_status", "leadStatusId"])),
    timeInStatus: asString(pick(map, ["time_in_status", "time in status", "timeInStatus"])),
    inactiveDays: asInt(pick(map, ["inactive_days", "inactive days", "inactiveDays"])),
    campaignId: asString(pick(map, ["campaign_id", "campaignId"])),
    lastCreditPulledDate: parsePacificDateOrDateTime(
      pick(map, ["last_credit_pulled_date", "last credit pulled date"]),
    ),
    droppedDate: parsePacificDateOrDateTime(
      pick(map, ["c772034", "Cordoba Dropped Date", "cordoba dropped date"]),
    ),
    source: asString(pick(map, ["c_source", "source"])),
    state: asString(pick(map, ["state"])),
    programStartDate: parsePacificDateOrDateTime(
      pick(map, ["program_start_date", "program start date"]),
    ),
    forthCreatedAt: parsePacificDateTime(pick(map, ["created", "created_at", "creation date"])),
  };
}
