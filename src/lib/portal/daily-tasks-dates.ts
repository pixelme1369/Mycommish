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

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** UTC weekday 0=Sun … 6=Sat for a calendar YMD. */
export function weekdayUtc(ymd: string): number {
  const { y, m, d } = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function nthWeekdayOfMonth(
  year: number,
  month1to12: number,
  weekday: number,
  n: number,
): string {
  // n-th weekday in month (1-based). weekday: 0=Sun … 6=Sat
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const ymd = `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dt = new Date(Date.UTC(year, month1to12 - 1, day));
    if (dt.getUTCMonth() !== month1to12 - 1) break;
    if (dt.getUTCDay() === weekday) {
      count += 1;
      if (count === n) return ymd;
    }
  }
  throw new Error(`nthWeekdayOfMonth failed ${year}-${month1to12} n=${n}`);
}

function lastWeekdayOfMonth(
  year: number,
  month1to12: number,
  weekday: number,
): string {
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  for (let day = lastDay; day >= 1; day--) {
    const ymd = `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (weekdayUtc(ymd) === weekday) return ymd;
  }
  throw new Error(`lastWeekdayOfMonth failed ${year}-${month1to12}`);
}

/** Observed date: Sat → Friday before, Sun → Monday after. */
export function observedHoliday(ymd: string): string {
  const wd = weekdayUtc(ymd);
  if (wd === 6) return shiftYmd(ymd, -1); // Sat → Fri
  if (wd === 0) return shiftYmd(ymd, 1); // Sun → Mon
  return ymd;
}

/** US federal holidays (observed) for a calendar year. */
export function usFederalHolidays(year: number): Set<string> {
  const fixed = [
    observedHoliday(`${year}-01-01`), // New Year's
    observedHoliday(`${year}-06-19`), // Juneteenth
    observedHoliday(`${year}-07-04`), // Independence Day
    observedHoliday(`${year}-11-11`), // Veterans Day
    observedHoliday(`${year}-12-25`), // Christmas
  ];
  const floating = [
    nthWeekdayOfMonth(year, 1, 1, 3), // MLK — 3rd Monday Jan
    nthWeekdayOfMonth(year, 2, 1, 3), // Presidents — 3rd Monday Feb
    lastWeekdayOfMonth(year, 5, 1), // Memorial — last Monday May
    nthWeekdayOfMonth(year, 9, 1, 1), // Labor — 1st Monday Sep
    nthWeekdayOfMonth(year, 10, 1, 2), // Columbus — 2nd Monday Oct
    nthWeekdayOfMonth(year, 11, 4, 4), // Thanksgiving — 4th Thursday Nov
  ];
  return new Set([...fixed, ...floating]);
}

const holidayCache = new Map<number, Set<string>>();

function holidaysForYmd(ymd: string): Set<string> {
  const year = Number(ymd.slice(0, 4));
  let set = holidayCache.get(year);
  if (!set) {
    set = usFederalHolidays(year);
    holidayCache.set(year, set);
  }
  // Also need adjacent year near New Year when rolling.
  const prev = holidayCache.get(year - 1) ?? usFederalHolidays(year - 1);
  holidayCache.set(year - 1, prev);
  const next = holidayCache.get(year + 1) ?? usFederalHolidays(year + 1);
  holidayCache.set(year + 1, next);
  return new Set([...prev, ...set, ...next]);
}

export function isWeekend(ymd: string): boolean {
  const wd = weekdayUtc(ymd);
  return wd === 0 || wd === 6;
}

export function isUsFederalHoliday(ymd: string): boolean {
  return holidaysForYmd(ymd).has(ymd);
}

export function isBusinessDay(ymd: string): boolean {
  return !isWeekend(ymd) && !isUsFederalHoliday(ymd);
}

/** If ymd is not a business day, roll forward to the next one. */
export function nextBusinessDayOnOrAfter(ymd: string): string {
  let d = ymd;
  for (let i = 0; i < 14; i++) {
    if (isBusinessDay(d)) return d;
    d = shiftYmd(d, 1);
  }
  return d;
}

/**
 * Follow-up due date: enrolled + N calendar days, then roll forward off
 * weekends / US federal holidays.
 */
export function followUpDueYmd(enrolledYmd: string, afterDays: 1 | 5): string {
  return nextBusinessDayOnOrAfter(shiftYmd(enrolledYmd, afterDays));
}

export function followUpTargets(now = new Date()): {
  todayYmd: string;
  /** Nominal enrolled date for day-1 if no holiday roll (display hint only). */
  day1Ymd: string;
  day5Ymd: string;
} {
  const todayYmd = pacificTodayYmd(now);
  return {
    todayYmd,
    day1Ymd: shiftYmd(todayYmd, -1),
    day5Ymd: shiftYmd(todayYmd, -5),
  };
}

/** Calendar YYYY-MM-DD list for a Pacific month label (YYYY-MM). */
export function ymdsInMonth(monthLabel: string): string[] {
  const [y, m] = monthLabel.split("-").map(Number);
  if (!y || !m) return [];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${monthLabel}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export function workingYmdsInMonth(monthLabel: string): string[] {
  return ymdsInMonth(monthLabel).filter(isBusinessDay);
}

export function workingDaysRemaining(monthLabel: string, todayYmd: string): string[] {
  return workingYmdsInMonth(monthLabel).filter((d) => d >= todayYmd);
}

export function workingDaysElapsed(monthLabel: string, todayYmd: string): string[] {
  return workingYmdsInMonth(monthLabel).filter((d) => d < todayYmd);
}

export function monthTitle(monthLabel: string): string {
  const [y, m] = monthLabel.split("-").map(Number);
  if (!y || !m) return monthLabel;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Instant → YYYY-MM-DD in America/Los_Angeles. */
export function pacificYmdFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
