import { useState } from "react"
import { Camera } from "lucide-react"

import { formatMealTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { Confidence } from "@/worker/models/estimate"
import type { MealListItemView } from "@/worker/views/meal"

export function MealCard({ meal }: { meal: MealListItemView }) {
  return (
    <article className="ring-foreground/10 flex items-center gap-4 rounded-xl bg-card p-3 ring-1">
      <PhotoThumb mealId={meal.id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-medium">{meal.dishName ?? "Couldn't read this meal"}</h3>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatMealTime(meal.capturedAt)}
          </span>
        </div>
        {meal.totals === null ? (
          // No successful Estimate yet (ADR 0017) — tapping the card opens the detail, where Retry lives.
          <p className="text-muted-foreground mt-1 text-sm">Tap to retry the estimate</p>
        ) : (
          <>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              ~{Math.round(meal.totals.kcal)}{" "}
              <span className="text-muted-foreground text-sm font-normal">kcal</span>
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs tabular-nums">
                P {Math.round(meal.totals.proteinG)}g <span className="mx-1">·</span> C{" "}
                {Math.round(meal.totals.carbsG)}g <span className="mx-1">·</span> F{" "}
                {Math.round(meal.totals.fatG)}g
              </p>
              {meal.overallConfidence !== null && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    CONFIDENCE_STYLES[meal.overallConfidence]
                  )}
                  aria-label={`${CONFIDENCE_LABELS[meal.overallConfidence]} confidence`}
                >
                  {CONFIDENCE_LABELS[meal.overallConfidence]}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  )
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-primary/15 text-primary",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-destructive/15 text-destructive",
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

function PhotoThumb({ mealId }: { mealId: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center rounded-lg">
        <Camera className="size-6" />
      </div>
    )
  }

  return (
    <img
      src={`/api/meals/${mealId}/photo`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="bg-muted size-20 shrink-0 rounded-lg object-cover"
    />
  )
}
