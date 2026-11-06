/**
 * Time-zone helpers. Everything is stored as UTC ms; these format and reason in a given IANA zone.
 * Pure functions (no Date.now()) so they work in Convex, Next and tests alike.
 */

export type OfficeHours = { day: number; open: string; close: string }[]; // day 0=Sun, "HH:MM" local

const SHORT_ZONE: Record<string, string> = {
  'America/Chicago': 'CT',
  'America/New_York': 'ET',
  'America/Denver': 'MT',
  'America/Phoenix': 'MT',
  'America/Los_Angeles': 'PT',
};

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function zonedParts(utcMs: number, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday ?? 'Sun'),
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function offsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

/** Convert a wall-clock time in `timeZone` to UTC ms (DST-safe). */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let utc = guess - offsetMs(guess, timeZone);
  // Second pass handles the case where the offset differs at the corrected instant (DST edges).
  utc = guess - offsetMs(utc, timeZone);
  return utc;
}

export function shortZone(timeZone: string, utcMs: number): string {
  if (SHORT_ZONE[timeZone]) return SHORT_ZONE[timeZone];
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === 'timeZoneName')?.value;
  return name ?? timeZone;
}

/** "9:00 AM" */
export function formatClock(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    new Date(utcMs),
  );
}

/** "9:00 AM CT (7:45 PM your time)" — or just "9:00 AM CT" when the zones match. */
export function formatDual(utcMs: number, officeTz: string, userTz: string): string {
  const office = `${formatClock(utcMs, officeTz)} ${shortZone(officeTz, utcMs)}`;
  if (offsetMs(utcMs, officeTz) === offsetMs(utcMs, userTz)) return office;
  return `${office} (${formatClock(utcMs, userTz)} your time)`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isOpen(hours: OfficeHours, timeZone: string, nowMs: number): boolean {
  const p = zonedParts(nowMs, timeZone);
  const mins = p.hour * 60 + p.minute;
  return hours.some((h) => h.day === p.weekday && mins >= toMinutes(h.open) && mins < toMinutes(h.close));
}

/** The next time the office opens (UTC ms), strictly after `nowMs`. Null if it has no hours. */
export function nextOpening(hours: OfficeHours, timeZone: string, nowMs: number): number | null {
  if (hours.length === 0) return null;
  const start = zonedParts(nowMs, timeZone);
  for (let offset = 0; offset <= 7; offset++) {
    // Walk calendar days in the office's zone.
    const base = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const weekday = base.getUTCDay();
    const todays = hours
      .filter((h) => h.day === weekday)
      .map((h) => toMinutes(h.open))
      .sort((a, b) => a - b);
    for (const openMin of todays) {
      const utc = zonedToUtc(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        Math.floor(openMin / 60),
        openMin % 60,
        timeZone,
      );
      if (utc > nowMs) return utc;
    }
  }
  return null;
}

/** "Mon–Fri 9:00 AM–5:00 PM" style one-liner for cards. */
export function describeHours(hours: OfficeHours): string {
  if (hours.length === 0) return 'Hours not listed';
  const first = hours[0]!;
  const same = hours.every((h) => h.open === first.open && h.close === first.close);
  const fmt = (hhmm: string) => {
    const mins = toMinutes(hhmm);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  const days = hours.map((h) => h.day).sort((a, b) => a - b);
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
  const dayLabel =
    contiguous && days.length > 1
      ? `${WEEKDAYS[days[0]!]}–${WEEKDAYS[days[days.length - 1]!]}`
      : days.map((d) => WEEKDAYS[d]).join(', ');
  return same ? `${dayLabel} ${fmt(first.open)}–${fmt(first.close)}` : `${dayLabel} (varies)`;
}
