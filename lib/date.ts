// lib/date.ts

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  })
}

export function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

export function mondayOfWeek(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function cycleDayOf(startDate: string): number {
  return daysBetween(startDate, todayISO()) + 1
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ─── AGENT TIMEFRAMES ────────────────────────────────────────────
// Shared by A2/A3 so the Insights period selector (week/month/etc.) maps
// to a consistent day-window and cache key everywhere it's used.

export type Period = 'week' | 'month' | 'quarter' | 'year' | 'last_month' | 'this_month'

export const VALID_PERIODS: Period[] = ['week', 'month', 'quarter', 'year', 'last_month', 'this_month']

export function isValidPeriod(value: string | null): value is Period {
  return !!value && (VALID_PERIODS as string[]).includes(value)
}

export function daysForPeriod(period: Period): number {
  switch (period) {
    case 'week': return 7
    case 'month': return 30
    case 'this_month': return 31
    case 'last_month': return 60
    case 'quarter': return 90
    case 'year': return 365
    default: return 30
  }
}