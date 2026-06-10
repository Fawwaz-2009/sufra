export type FirstDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function todayLocal(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return formatLocalDate(a) === formatLocalDate(b);
}

// A Profile edit takes effect NEXT local midnight — today's plan is sealed (ADR 0002).
export function tomorrowLocalDate(now: Date = new Date()): string {
  return formatLocalDate(addDays(todayLocal(now), 1));
}

// The web leans on <input type="date"> for calendar validity; native birthday entry is bare numeric
// fields, so validity (a real calendar date, not in the future, within 110 years) checks here.
export function isValidBirthday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false;
  const today = new Date();
  const oldest = new Date(today.getFullYear() - 110, today.getMonth(), today.getDate());
  return date <= today && date >= oldest;
}

export function diffInLocalDays(a: Date, b: Date): number {
  const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMs - bMs) / 86_400_000);
}

export function weekStart(d: Date, firstDay: FirstDayOfWeek = 1): Date {
  const jsDay = d.getDay();
  const intlDay = jsDay === 0 ? 7 : jsDay;
  const diff = (intlDay - firstDay + 7) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - diff);
  return start;
}

export function weekDays(weekStartDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
}

export function weekRange(weekStartDate: Date): { from: string; to: string } {
  return {
    from: weekStartDate.toISOString(),
    to: addDays(weekStartDate, 7).toISOString(),
  };
}

// Anchored at noon to dodge DST-shift edge cases that could otherwise push
// the moment into an adjacent local Day.
export function localDateForCapture(selectedDay: Date): string {
  return new Date(
    selectedDay.getFullYear(),
    selectedDay.getMonth(),
    selectedDay.getDate(),
    12,
    0,
    0,
    0
  ).toISOString();
}

// Hardcoded Today/Yesterday instead of the web's Intl.RelativeTimeFormat — Hermes
// doesn't reliably ship it, and the product is English-only in v1.
export function selectedDayLabel(selectedDay: Date, today: Date): string {
  const diff = diffInLocalDays(selectedDay, today);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(selectedDay);
}

export function formatMealTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
