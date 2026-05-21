import { Sparkle } from "@phosphor-icons/react"

import type { MealDetail } from "../../../../../worker/meals/schema"

export function AiBreakdown({
  foods,
}: {
  foods: MealDetail["aiAnalysis"]["foods"]
}) {
  return (
    <section
      className="ring-foreground/10 rounded-xl bg-card p-4 ring-1"
      aria-label="AI estimate breakdown"
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
        <Sparkle weight="fill" className="size-3" />
        AI estimate
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-foreground/5">
        {foods.map((f, idx) => (
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
    </section>
  )
}
