import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { getClient, run } from "@/client/api-client"
import type { MealView } from "@/worker/views/meal"

export function ImproveEstimateSheet({
  open,
  onOpenChange,
  mealId,
  clarifications,
  lastRefinementText,
  onRefined,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mealId: string
  clarifications: MealView["aiAnalysis"]["clarifications"]
  lastRefinementText: string | null
  onRefined: () => void
}) {
  const [text, setText] = useState(lastRefinementText ?? "")

  // Re-sync the textarea whenever the sheet is (re)opened — the parent's lastRefinementText updates
  // after a successful refine, and we want a re-open to show the freshest value. This is React's
  // "adjust state during render" pattern (storing the previous `open`), not an effect — so it re-syncs
  // in the same render the sheet opens, with no cascading-render round-trip.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setText(lastRefinementText ?? "")
  }

  const mutation = useMutation({
    mutationKey: ["meal", mealId],
    mutationFn: async (userText: string) =>
      run((await getClient()).refinement.create({ params: { id: mealId }, payload: { userText } })),
    onSuccess: () => {
      onRefined()
      onOpenChange(false)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    mutation.mutate(trimmed)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-4">
        <SheetTitle>Improve this estimate</SheetTitle>

        {clarifications.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              The AI wasn't sure about
            </p>
            <ul className="flex flex-col gap-1.5">
              {clarifications.map((q) => (
                <li
                  key={q.id}
                  className="text-foreground text-sm leading-snug before:me-1.5 before:content-['•']"
                >
                  {q.question}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label
            htmlFor="improve-text"
            className="text-muted-foreground text-xs font-medium uppercase tracking-wider"
          >
            Tell the AI what it missed
          </label>
          <textarea
            id="improve-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 2 scoops mixed with water"
            rows={4}
            disabled={mutation.isPending}
            autoFocus
            className="border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {mutation.isError && (
            <p className="text-destructive text-xs">
              Couldn't refine. {mutation.error?.message ?? ""}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || text.trim().length === 0}
              className="flex-1"
            >
              {mutation.isPending ? "Refining…" : "Refine with AI"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
