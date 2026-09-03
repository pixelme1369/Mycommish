const DEFAULT_BASE = "https://api.forthcrm.com/v1";
const PER_PAGE = 100;

export type ForthListPage = {
  contacts: unknown[];
  nextPage: number | null;
};

function apiKey(): string {
  const key = (process.env.FORTH_API_KEY || "").trim();
  if (!key) throw new Error("FORTH_API_KEY is not set");
  return key;
}

function listIds(): string[] {
  const primary = (process.env.FORTH_LIST_ID || "").trim();
  const enrolled = (process.env.FORTH_ENROLLED_LIST_ID || "").trim();
  const ids = [primary, enrolled].filter(Boolean);
  if (!ids.length) throw new Error("FORTH_LIST_ID is not set");
  return [...new Set(ids)];
}

function baseUrl(): string {
  return (process.env.FORTH_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function extractContacts(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const obj = asRecord(payload);
  if (!obj) return [];
  for (const key of ["contacts", "data", "results", "items", "rows"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  const response = asRecord(obj.response);
  if (response) {
    for (const key of ["contacts", "data", "results"]) {
      const v = response[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function nextPageFrom(payload: unknown, page: number, got: number): number | null {
  const obj = asRecord(payload);
  const resp = asRecord(obj?.response) ?? obj ?? {};
  const current = Number(resp.page ?? resp.current_page ?? page) || page;
  const perPage = Number(resp.per_page ?? resp.perPage ?? PER_PAGE) || PER_PAGE;
  const totalPages = Number(resp.total_pages ?? resp.last_page ?? resp.pages ?? 0);
  const total = Number(resp.total_contacts ?? resp.total ?? 0);
  const pagesFromTotal = total > 0 ? Math.ceil(total / perPage) : 0;
  const last = totalPages || pagesFromTotal;
  if (last && current >= last) return null;
  if (!last && got === 0) return null;
  if (!last && got < perPage) return null;
  return current + 1;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "Api-Key": apiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    throw new Error(`Forth ${res.status} ${url}: ${text.slice(0, 400)}`);
  }
  return json;
}

function pageUrls(listId: string, page: number): string[] {
  const base = baseUrl();
  const q = `page=${page}&per_page=${PER_PAGE}`;
  return [`${base}/contacts/lists/${encodeURIComponent(listId)}?${q}`];
}

export async function fetchForthListPage(
  listId: string,
  page: number,
): Promise<ForthListPage> {
  let lastErr: Error | null = null;
  for (const url of pageUrls(listId, page)) {
    try {
      const payload = await fetchJson(url);
      const contacts = extractContacts(payload);
      return { contacts, nextPage: nextPageFrom(payload, page, contacts.length) };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message.includes("Forth 401") || lastErr.message.includes("Forth 403")) {
        throw lastErr;
      }
    }
  }
  throw lastErr ?? new Error("Forth list fetch failed");
}

export async function fetchAllForthContacts(): Promise<unknown[]> {
  const ids = listIds();
  const all: unknown[] = [];
  for (const listId of ids) {
    let page = 1;
    for (;;) {
      const { contacts, nextPage } = await fetchForthListPage(listId, page);
      all.push(...contacts);
      if (nextPage == null) break;
      page = nextPage;
      await sleep(80);
    }
  }
  return all;
}

/** Forth person-picker fields store user ids; resolve to "First Last". */
export async function fetchForthUserDisplayName(userId: string): Promise<string | null> {
  const id = userId.trim();
  if (!id) return null;
  try {
    const payload = await fetchJson(`${baseUrl()}/users/${encodeURIComponent(id)}`);
    const obj = asRecord(payload);
    const user = asRecord(obj?.response) ?? obj;
    if (!user) return null;
    const first = String(user.firstname ?? user.first_name ?? "").trim();
    const last = String(user.lastname ?? user.last_name ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ").trim();
    if (full) return full;
    const username = String(user.user_name ?? user.username ?? "").trim();
    return username || null;
  } catch {
    return null;
  }
}

/** Resolve many Forth user ids with a small in-memory cache + polite delay. */
export async function resolveForthUserDisplayNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, string>();
  for (const id of unique) {
    const name = await fetchForthUserDisplayName(id);
    if (name) out.set(id, name);
    await sleep(40);
  }
  return out;
}
