import { useState } from "react"
import { Camera, WarningCircle } from "@phosphor-icons/react"

import { formatMealTime } from "@/lib/date"
import { cn } from "@/lib/utils"

export type MealCardData = {
  id: string
  capturedAt: string
  analysisStatus: "pending" | "analyzed" | "failed"
  analysisError: string | null
  dishName: string | null
  overallConfidence: "high" | "medium" | "low" | null
  totals: {
    kcal: number
    proteinG: number
    carbsG: number
    fatG: number
  } | null
}

const CONFIDENCE_STYLES: Record<"high" | "medium" | "low", string> = {
  high: "bg-primary/15 text-primary",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-destructive/15 text-destructive",
}

const CONFIDENCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export function MealCard({ meal }: { meal: MealCardData }) {
  if (meal.analysisStatus === "pending") return <PendingMealCard meal={meal} />
  if (meal.analysisStatus === "failed") return <FailedMealCard meal={meal} />
  return <AnalyzedMealCard meal={meal} />
}

function AnalyzedMealCard({ meal }: { meal: MealCardData }) {
  if (!meal.totals || !meal.dishName || !meal.overallConfidence) return null

  const kcal = Math.round(meal.totals.kcal)
  const p = Math.round(meal.totals.proteinG)
  const c = Math.round(meal.totals.carbsG)
  const f = Math.round(meal.totals.fatG)

  return (
    <article className="ring-foreground/10 flex items-center gap-4 rounded-xl bg-card p-3 ring-1">
      <PhotoThumb mealId={meal.id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-medium">{meal.dishName}</h3>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatMealTime(meal.capturedAt)}
          </span>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          ~{kcal} <span className="text-muted-foreground text-sm font-normal">kcal</span>
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs tabular-nums">
            P {p}g <span className="mx-1">·</span> C {c}g <span className="mx-1">·</span> F {f}g
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              CONFIDENCE_STYLES[meal.overallConfidence]
            )}
            aria-label={`${CONFIDENCE_LABELS[meal.overallConfidence]} confidence`}
          >
            {CONFIDENCE_LABELS[meal.overallConfidence]}
          </span>
        </div>
      </div>
    </article>
  )
}

function PendingMealCard({ meal }: { meal: MealCardData }) {
  return (
    <article
      className="ring-foreground/10 flex items-center gap-4 rounded-xl bg-card p-3 ring-1"
      aria-busy="true"
    >
      <PhotoThumb mealId={meal.id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-muted-foreground truncate text-sm font-medium">
            Analyzing…
          </h3>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatMealTime(meal.capturedAt)}
          </span>
        </div>
        <div className="bg-muted mt-2 h-6 w-1/3 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-3 w-1/2 animate-pulse rounded" />
      </div>
    </article>
  )
}

function FailedMealCard({ meal }: { meal: MealCardData }) {
  return (
    <article className="ring-destructive/30 flex items-center gap-4 rounded-xl bg-card p-3 ring-1">
      <PhotoThumb mealId={meal.id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-medium">Couldn't analyze</h3>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatMealTime(meal.capturedAt)}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <WarningCircle className="size-3.5 shrink-0" />
          <span className="truncate">
            {meal.analysisError ?? "Analysis failed"}
          </span>
        </p>
      </div>
    </article>
  )
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
