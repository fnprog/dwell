/**
 * Date helpers. Dates are plain "YYYY-MM-DD" strings, handled in UTC so a
 * phone in any timezone computes the same answer for the same date.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(iso: string): { y: number; m: number; d: number } {
  const match = ISO.exec(iso);
  if (!match) throw new Error(`Invalid date: "${iso}"`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid date: "${iso}"`);
  }
  return { y, m, d };
}

export function formatDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toDayNumber(iso: string): number {
  const { y, m, d } = parseDate(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNumber(day: number): string {
  const date = new Date(day * 86_400_000);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days);
}

/**
 * Add calendar months, keeping the day of month where it exists and otherwise
 * clamping to the last day (31 Jan + 1 month = 28/29 Feb).
 */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseDate(iso);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return formatDate(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Today as YYYY-MM-DD in the device's local calendar. */
export function todayLocal(now: Date = new Date()): string {
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
