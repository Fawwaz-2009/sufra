import { useState } from "react"
import { Sparkles, Pencil } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Confidence } from "../../../../../worker/meals/estimator/schema"
import type { MealDetail } from "../../../../../worker/meals/schema"
import { ImproveEstimateSheet } from "./improve-estimate-sheet"

// The Improve button's color reflects how unsure the AI was. Members never
// read "HIGH/MEDIUM/LOW" — the color does that work. High = quiet primary
// outline ("improve if you want"). Medium = amber. Low = destructive red
// ("this estimate needs your input"). See PRD §10 #11 and CONTEXT.md
// "Confidence" / "Clarification" for the doctrine.
const IMPROVE_BUTTON_STYLES: Record<Confidence, string> = {
  high: "border-primary/40 text-primary hover:bg-primary/5",
  medium:
    "border-amber-500/50 text-amber-700 hover:bg-amber-500/5 dark:text-amber-400",
  low: "border-destructive/50 text-destructive hover:bg-destructive/5",
}

export function AiBreakdown({
  mealId,
  aiAnalysis,
  lastRefinementText,
  onRefined,
}: {
  mealId: string
  aiAnalysis: MealDetail["aiAnalysis"]
  lastRefinementText: string | null
  onRefined: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <section
      className="ring-foreground/10 rounded-xl bg-card p-4 ring-1"
      aria-label="AI estimate breakdown"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
          <Sparkles className="size-3 fill-current" />
          AI estimate
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            IMPROVE_BUTTON_STYLES[aiAnalysis.overallConfidence]
          )}
        >
          <Pencil className="size-3" strokeWidth={2.5} />
          Improve
        </button>
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-foreground/5">
        {aiAnalysis.foods.map((f, idx) => (
          <li
            key={idx}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-medium">{f.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {f.portionEstimate} {f.portionUnit} ·{" "}
                {Math.round(f.portionGrams)}g
              </p>
              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                P {Math.round(f.estimatedProteinG)}g
                <span className="mx-1">·</span>
                C {Math.round(f.estimatedCarbsG)}g
                <span className="mx-1">·</span>
                F {Math.round(f.estimatedFatG)}g
              </p>
            </div>
            <p className="text-muted-foreground shrink-0 tabular-nums">
              {Math.round(f.estimatedKcal)} kcal
            </p>
          </li>
        ))}
      </ul>

      <ImproveEstimateSheet
        open={open}
        onOpenChange={setOpen}
        mealId={mealId}
        clarifications={aiAnalysis.clarifications}
        lastRefinementText={lastRefinementText}
        onRefined={onRefined}
      />
    </section>
  )
}
