import { and, desc, eq, gte, lt } from "drizzle-orm"

import { createDb } from "../db"
import { meal, profileLog } from "../db/schema"
import { resolveTotals } from "../meals/isomorphic/totals"
import {
  deriveProfile,
  snapshotFor,
  type ProfileSnapshot,
} from "../profile/isomorphic/derive"
import type {
  CalorieHistoryBucket,
  CalorieHistoryBucketItem,
  CalorieHistoryRangeInput,
} from "./schema"

type CalorieHistoryEnv = { DB: D1Database }

export function createCalorieHistoryModule(env: CalorieHistoryEnv) {
  const db = createDb(env.DB)

  return {
    async list(args: {
      memberId: string
      input: CalorieHistoryRangeInput
    }): Promise<CalorieHistoryBucketItem[]> {
      const { from, to, bucket, tz } = args.input

      const meals = await db
        .select({
          capturedAt: meal.capturedAt,
          aiAnalysis: meal.aiAnalysis,
          override: meal.override,
        })
        .from(meal)
        .where(
          and(
            eq(meal.userId, args.memberId),
            gte(meal.capturedAt, from),
            lt(meal.capturedAt, to)
          )
        )

      const profileRows = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.userId, args.memberId))
        .orderBy(desc(profileLog.effectiveFrom))
      // drizzle's $inferSelect gives `createdAt: Date`; ProfileSnapshot (the
      // wire/derive shape) expects an ISO string. Map at the seam.
      const profiles: ProfileSnapshot[] = profileRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))

      const dailyKcal = new Map<string, number>()
      for (const m of meals) {
        const localDate = formatLocalDateInTz(m.capturedAt, tz)
        const { kcal } = resolveTotals(m.aiAnalysis, m.override)
        dailyKcal.set(localDate, (dailyKcal.get(localDate) ?? 0) + kcal)
      }

      const days = enumerateLocalDays(from, to, tz)

      const dailyItems = days.map((day) => {
        const kcal = dailyKcal.get(day) ?? null
        const snapshot = snapshotFor(profiles, day)
        const target = snapshot ? deriveProfile(snapshot).targetKcal : 0
        return { day, kcal, target }
      })

      const groups = groupDays(dailyItems, bucket)

      return groups.map((g) => {
        const daysWithData = g.items.filter((d) => d.kcal !== null).length
        const kcalSum = g.items.reduce((acc, d) => acc + (d.kcal ?? 0), 0)
        const kcalAvg = daysWithData > 0 ? kcalSum / daysWithData : 0
        const targetSum = g.items.reduce((acc, d) => acc + d.target, 0)
        const targetAvg = g.items.length > 0 ? targetSum / g.items.length : 0
        return {
          bucketStart: g.bucketStart,
          kcalAvg: Math.round(kcalAvg),
          targetAvg: Math.round(targetAvg),
          color:
            daysWithData === 0 ? null : classifyAgainstTarget(kcalAvg, targetAvg),
          daysWithData,
        }
      })
    },
  }
}

export type CalorieHistoryModule = ReturnType<typeof createCalorieHistoryModule>

// Same thresholds as the Day view's week strip + Day Summary ring:
//   ok    <= target
//   warn  0–15% over
//   over  > 15% over
function classifyAgainstTarget(
  kcal: number,
  target: number
): "ok" | "warn" | "over" {
  if (target <= 0) return "ok"
  const pct = kcal / target
  if (pct <= 1) return "ok"
  if (pct <= 1.15) return "warn"
  return "over"
}

// Returns YYYY-MM-DD for the given UTC instant projected into `tz`.
// `en-CA` is used because Intl formats it as ISO-like (YYYY-MM-DD).
function formatLocalDateInTz(iso: string, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date(iso))
}

// Enumerate every local-tz day touched by the [from, to) UTC window.
// We use the local date of `from` as the inclusive start, and walk forward
// until we hit the local date that contains `to`'s instant (exclusive).
function enumerateLocalDays(
  fromIso: string,
  toIso: string,
  tz: string
): string[] {
  const startLocal = formatLocalDateInTz(fromIso, tz)
  const endInstant = new Date(toIso).getTime()

  const days: string[] = []
  let cursor = startLocal
  // Cap at 400 days as a defensive bound; the largest UI period is 1Y.
  for (let i = 0; i < 400; i++) {
    days.push(cursor)
    const nextLocalDayInstant = nextLocalDayStartInstant(cursor, tz)
    if (nextLocalDayInstant >= endInstant) break
    cursor = addOneLocalDay(cursor)
  }
  return days
}

// `localDate` (YYYY-MM-DD) → epoch ms of that day's 00:00 in `tz`. Used to
// know when we've stepped past the requested `to` instant.
function nextLocalDayStartInstant(localDate: string, tz: string): number {
  const next = addOneLocalDay(localDate)
  // Construct a "Date object at midnight UTC of next day", then offset by the
  // TZ's offset at that moment so we land on local midnight there. We do this
  // by parsing "YYYY-MM-DDT00:00:00" via formatting back the same way.
  const [y, m, d] = next.split("-").map(Number)
  const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const localOfCandidate = formatLocalDateInTz(candidate.toISOString(), tz)
  // If formatting it back doesn't give us `next`, the TZ shifted us; bisect
  // by ±24h in worst case. For most TZs (offsets within ±14h), one step
  // either direction is enough.
  if (localOfCandidate === next) return candidate.getTime()
  if (localOfCandidate < next) return candidate.getTime() + 24 * 3600_000
  return candidate.getTime() - 24 * 3600_000
}

function addOneLocalDay(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  const ny = dt.getUTCFullYear()
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const nd = String(dt.getUTCDate()).padStart(2, "0")
  return `${ny}-${nm}-${nd}`
}

type DailyItem = { day: string; kcal: number | null; target: number }
type Group = { bucketStart: string; items: DailyItem[] }

function groupDays(items: DailyItem[], bucket: CalorieHistoryBucket): Group[] {
  if (bucket === "day") return items.map((d) => ({ bucketStart: d.day, items: [d] }))
  if (bucket === "week") return groupByISOWeek(items)
  return groupByMonth(items)
}

function groupByISOWeek(items: DailyItem[]): Group[] {
  const groups = new Map<string, Group>()
  for (const d of items) {
    const monday = isoWeekMonday(d.day)
    let g = groups.get(monday)
    if (!g) {
      g = { bucketStart: monday, items: [] }
      groups.set(monday, g)
    }
    g.items.push(d)
  }
  return [...groups.values()].sort((a, b) =>
    a.bucketStart < b.bucketStart ? -1 : 1
  )
}

function groupByMonth(items: DailyItem[]): Group[] {
  const groups = new Map<string, Group>()
  for (const d of items) {
    const month = `${d.day.slice(0, 7)}-01`
    let g = groups.get(month)
    if (!g) {
      g = { bucketStart: month, items: [] }
      groups.set(month, g)
    }
    g.items.push(d)
  }
  return [...groups.values()].sort((a, b) =>
    a.bucketStart < b.bucketStart ? -1 : 1
  )
}

// Monday of the ISO week containing `localDate` (YYYY-MM-DD).
function isoWeekMonday(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0..6, Sun=0
  const offsetToMonday = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + offsetToMonday)
  const ny = dt.getUTCFullYear()
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const nd = String(dt.getUTCDate()).padStart(2, "0")
  return `${ny}-${nm}-${nd}`
}
