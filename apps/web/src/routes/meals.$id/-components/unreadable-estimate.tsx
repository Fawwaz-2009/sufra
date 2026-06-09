import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { getClient, run } from "@/client/api-client"

/**
 * The retry panel shown on a meal whose current Estimate failed (ADR 0017: the AI failing is data, not an
 * error). A plain retry re-runs the estimator on the SAME stored photo (no re-upload) — `estimates.create`
 * with no `userText`. The server's human message (mapped from the latest error code) is shown verbatim.
 */
export function UnreadableEstimate({
  mealId,
  message,
  onRetried,
}: {
  mealId: string
  message: string
  onRetried: () => void
}) {
  const retry = useMutation({
    mutationKey: ["meal", mealId],
    mutationFn: async () =>
      run((await getClient()).estimates.create({ params: { id: mealId }, payload: {} })),
    onSuccess: onRetried,
  })

  return (
    <section className="ring-foreground/10 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={() => retry.mutate()} disabled={retry.isPending} className="flex-1">
        {retry.isPending ? "Retrying…" : "Retry estimate"}
      </Button>
      {retry.isError && (
        <p className="text-destructive text-xs">Still couldn't reach the vision service. Try again.</p>
      )}
    </section>
  )
}
