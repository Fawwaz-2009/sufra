import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import type { Confidence } from "../../../../worker/meals/estimator/schema"
import { resolveTotals } from "../../../../worker/meals/isomorphic/totals"
import { AiBreakdown } from "./-components/ai-breakdown"
import { DetailShell } from "./-components/detail-shell"
import { MealDetailError } from "./-components/error"
import { MealNotFound } from "./-components/not-found"
import { OverrideEditor } from "./-components/override-editor"
import { MealDetailPending } from "./-components/pending"
import { PhotoHero } from "./-components/photo-hero"
import { RefineSection } from "./-components/refine-section"
import { mealDetailKey, mealQueryOptions } from "./-queries"

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-primary/15 text-primary",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  low: "bg-destructive/15 text-destructive",
}

export const Route = createFileRoute("/meals/$id")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    return { session: context.session }
  },
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      mealQueryOptions(params.id)
    )
    if (!data) throw notFound()
    return data
  },
  pendingComponent: MealDetailPending,
  notFoundComponent: MealNotFound,
  errorComponent: MealDetailError,
  component: MealDetail,
})

function MealDetail() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  // Loader threw notFound() on null, so data is guaranteed defined here.
  const meal = useSuspenseQuery(mealQueryOptions(id)).data!

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: mealDetailKey(id) })
    queryClient.invalidateQueries({ queryKey: ["meals"] })
  }

  const ai = meal.aiAnalysis
  const aiSum = resolveTotals(ai, null)
  const time = new Date(meal.capturedAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <DetailShell>
      <PhotoHero mealId={id} />
      <div className="flex flex-col gap-6 px-5 pt-4 pb-12">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold">
              {ai.dishName}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{time}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
              CONFIDENCE_STYLES[ai.overallConfidence]
            )}
          >
            {ai.overallConfidence}
          </span>
        </div>

        <OverrideEditor meal={meal} aiSum={aiSum} onSaved={onSaved} />

        <RefineSection
          mealId={meal.id}
          clarifications={ai.clarifications}
          onRefined={onSaved}
        />

        <AiBreakdown foods={ai.foods} />
      </div>
    </DetailShell>
  )
}
