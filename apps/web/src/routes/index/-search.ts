import { z } from "zod"

import { diffInLocalDays, parseLocalDate, todayLocal } from "@/lib/date"

// Search-param schema for the Day view. `date` is optional; absence ⇒ today.
// Future dates are rejected at parse time — the URL would otherwise let a
// Member navigate to "tomorrow" and see the empty shell, which is confusing.
// `.catch(undefined)` makes a malformed date silently fall back to today
// rather than throwing — the URL is recoverable without a hard error page.
export const indexSearchSchema = z.object({
  date: z.iso
    .date()
    .refine(
      (s) => diffInLocalDays(parseLocalDate(s), todayLocal()) <= 0,
      "future_date"
    )
    .optional()
    .catch(undefined),
})

export type IndexSearch = z.infer<typeof indexSearchSchema>

export function resolveSelectedDay(search: IndexSearch): Date {
  return search.date ? parseLocalDate(search.date) : todayLocal()
}
