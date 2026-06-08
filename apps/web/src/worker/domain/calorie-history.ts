import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { MealsRepo } from "../db/meals.ts"
import { ProfileSnapshotsRepo } from "../db/profile-snapshots.ts"
import { run } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import type { Meal } from "../models/meal.ts"
import { resolveTotals } from "../views/meal.ts"
import { toProfileSnapshotView, type ProfileSnapshotView } from "../views/profile-snapshot.ts"
import { deriveProfile, snapshotFor } from "../views/derive.ts"
import type { CalorieBucket, CalorieHistoryBucketView } from "../views/calorie-history.ts"

/**
 * Calorie history — the Progress Calories rollup (ADR 0011). A READ-MODEL: no writes → a plain read verb,
 * not an aggregate-with-concerns (the `Cost` precedent). It reads the Member's meals + Profile snapshots,
 * buckets meal Totals into LOCAL days by the Member's TZ (Day boundaries are TZ-local — CONTEXT "Day"),
 * attaches each day's HISTORICAL Target (`snapshotFor` + `deriveProfile`, honoring the ADR 0002 seal), then
 * rolls days up to the requested bucket (avg over logged days + adherence color). The TZ math lives here,
 * server-side, so the chart renders without re-deriving — `views/derive.ts` is the SHARED formula.
 */
const index = Effect.fn("CalorieHistory.index")(function* (query: {
  readonly from: string
  readonly to: string
  readonly bucket: CalorieBucket
  readonly tz: string
}) {
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo
  const snapshots = yield* ProfileSnapshotsRepo

  const mealRows = yield* run(meals.inRange({ userId, from: query.from, to: query.to }))
  const profiles = (yield* run(snapshots.history({ userId }))).map(toProfileSnapshotView) // DESC by effectiveFrom
  return rollup(mealRows, profiles, query)
})

export const CalorieHistory = { index } as const

// ── the pure rollup + TZ helpers (ported from the old Hono calorie-history module; server-only, no Effect) ──

const rollup = (
  mealRows: ReadonlyArray<typeof Meal.select.Type>,
  profiles: ReadonlyArray<ProfileSnapshotView>,
  query: { readonly from: string; readonly to: string; readonly bucket: CalorieBucket; readonly tz: string }
): ReadonlyArray<CalorieHistoryBucketView> => {
  const dailyKcal = new Map<string, number>()
  for (const m of mealRows) {
    const localDate = formatLocalDateInTz(m.capturedAt, query.tz)
    const { kcal } = resolveTotals(m.aiAnalysis, Option.getOrNull(m.override))
    dailyKcal.set(localDate, (dailyKcal.get(localDate) ?? 0) + kcal)
  }

  const dailyItems = enumerateLocalDays(query.from, query.to, query.tz).map((day) => {
    const snapshot = snapshotFor(profiles, day)
    return { day, kcal: dailyKcal.get(day) ?? null, target: snapshot ? deriveProfile(snapshot).targetKcal : 0 }
  })

  return groupDays(dailyItems, query.bucket).map((g) => {
    const daysWithData = g.items.filter((d) => d.kcal !== null).length
    const kcalSum = g.items.reduce((acc, d) => acc + (d.kcal ?? 0), 0)
    const kcalAvg = daysWithData > 0 ? kcalSum / daysWithData : 0
    const targetSum = g.items.reduce((acc, d) => acc + d.target, 0)
    const targetAvg = g.items.length > 0 ? targetSum / g.items.length : 0
    return {
      bucketStart: g.bucketStart,
      kcalAvg: Math.round(kcalAvg),
      targetAvg: Math.round(targetAvg),
      color: daysWithData === 0 ? null : classifyAgainstTarget(kcalAvg, targetAvg),
      daysWithData
    }
  })
}

// Same thresholds as the Day view's week strip + Day Summary ring: ok ≤ target, warn 0–15% over, over > 15%.
const classifyAgainstTarget = (kcal: number, target: number): "ok" | "warn" | "over" => {
  if (target <= 0) return "ok"
  const pct = kcal / target
  if (pct <= 1) return "ok"
  if (pct <= 1.15) return "warn"
  return "over"
}

// YYYY-MM-DD for a UTC instant projected into `tz`. `en-CA` formats as ISO-like (YYYY-MM-DD).
const formatLocalDateInTz = (iso: string, tz: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  )

// Every local-tz day touched by the [from, to) UTC window — local date of `from` (inclusive) walking forward
// until the local day containing `to`'s instant (exclusive). Capped at 400 days (the largest UI period is 1Y).
const enumerateLocalDays = (fromIso: string, toIso: string, tz: string): Array<string> => {
  const endInstant = new Date(toIso).getTime()
  const days: Array<string> = []
  let cursor = formatLocalDateInTz(fromIso, tz)
  for (let i = 0; i < 400; i++) {
    days.push(cursor)
    if (nextLocalDayStartInstant(cursor, tz) >= endInstant) break
    cursor = addOneLocalDay(cursor)
  }
  return days
}

// Parse a `YYYY-MM-DD` into [year, month, day] numbers (the format is validated upstream; under
// noUncheckedIndexedAccess a bare destructure would be `number | undefined`).
const ymd = (localDate: string): readonly [number, number, number] => {
  const p = localDate.split("-")
  return [Number(p[0]), Number(p[1]), Number(p[2])]
}

// `localDate` (YYYY-MM-DD) → epoch ms of the NEXT day's 00:00 in `tz` (to know when we've passed `to`).
const nextLocalDayStartInstant = (localDate: string, tz: string): number => {
  const next = addOneLocalDay(localDate)
  const [y, m, d] = ymd(next)
  const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const localOfCandidate = formatLocalDateInTz(candidate.toISOString(), tz)
  if (localOfCandidate === next) return candidate.getTime()
  if (localOfCandidate < next) return candidate.getTime() + 24 * 3600_000
  return candidate.getTime() - 24 * 3600_000
}

const addOneLocalDay = (localDate: string): string => {
  const [y, m, d] = ymd(localDate)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

type DailyItem = { readonly day: string; readonly kcal: number | null; readonly target: number }
type Group = { readonly bucketStart: string; readonly items: Array<DailyItem> }

const groupDays = (items: Array<DailyItem>, bucket: CalorieBucket): Array<Group> => {
  if (bucket === "day") return items.map((d) => ({ bucketStart: d.day, items: [d] }))
  const key = bucket === "week" ? isoWeekMonday : firstOfMonth
  const groups = new Map<string, Group>()
  for (const d of items) {
    const k = key(d.day)
    const g = groups.get(k)
    if (g) g.items.push(d)
    else groups.set(k, { bucketStart: k, items: [d] })
  }
  return [...groups.values()].sort((a, b) => (a.bucketStart < b.bucketStart ? -1 : 1))
}

const firstOfMonth = (localDate: string): string => `${localDate.slice(0, 7)}-01`

// Monday of the ISO week containing `localDate` (YYYY-MM-DD).
const isoWeekMonday = (localDate: string): string => {
  const [y, m, d] = ymd(localDate)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0..6, Sun = 0
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}
