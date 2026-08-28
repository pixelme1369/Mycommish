const PACIFIC = "America/Los_Angeles";

/** Today's calendar date in US Pacific as YYYY-MM-DD. */
export function pacificTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Add/subtract whole calendar days from a YYYY-MM-DD string. */
export function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function ymdFromParsed(d: Date): string {
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function followUpTargets(now = new Date()): {
  day3Ymd: string;
  day10Ymd: string;
  todayYmd: string;
} {
  const todayYmd = pacificTodayYmd(now);
  return {
    todayYmd,
    day3Ymd: shiftYmd(todayYmd, -3),
    day10Ymd: shiftYmd(todayYmd, -10),
  };
}
