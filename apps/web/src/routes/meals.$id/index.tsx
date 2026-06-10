import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { requireOnboarded } from "@/client/gate"
import { estimateErrorMessage } from "@/worker/views/meal"
import { AiBreakdown } from "./-components/ai-breakdown"
import { BookmarkButton } from "./-components/bookmark-button"
import { DeleteMealButton } from "./-components/delete-meal-button"
import { DetailShell } from "./-components/detail-shell"
import { MealDetailError } from "./-components/error"
import { MealNotFound } from "./-components/not-found"
import { OverrideEditor } from "./-components/override-editor"
import { MealDetailPending } from "./-components/pending"
import { PhotoHero } from "./-components/photo-hero"
import { UnreadableEstimate } from "./-components/unreadable-estimate"
import { mealDetailKey, mealQueryOptions } from "./-queries"

export const Route = createFileRoute("/meals/$id/")({
  beforeLoad: ({ context }) => requireOnboarded(context.queryClient),
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

  // The current Estimate (latest "ok"), or null when the AI hasn't succeeded yet (ADR 0017) — then we
  // show the retry panel instead of the breakdown/override editor. The failure is data, not an error.
  const ai = meal.aiAnalysis
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
              {ai ? ai.dishName : "Couldn't read this meal"}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{time}</p>
          </div>
          <BookmarkButton mealId={meal.id} saved={meal.savedAt != null} />
        </div>

        {ai ? (
          <>
            <OverrideEditor meal={meal} analysis={ai} onSaved={onSaved} />
            <AiBreakdown
              mealId={meal.id}
              analysis={ai}
              lastRefinementText={meal.lastRefinementText}
              onRefined={onSaved}
            />
          </>
        ) : (
          <UnreadableEstimate
            mealId={meal.id}
            message={estimateErrorMessage(meal.latestErrorCode)}
            onRetried={onSaved}
          />
        )}

        <DeleteMealButton mealId={meal.id} />
      </div>
    </DetailShell>
  )
}
