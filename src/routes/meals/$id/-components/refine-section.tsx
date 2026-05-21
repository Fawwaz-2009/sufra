import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import type { MealDetail } from "../../../../../worker/meals/schema"

export function RefineSection({
  mealId,
  clarifications,
  onRefined,
}: {
  mealId: string
  clarifications: MealDetail["aiAnalysis"]["clarifications"]
  onRefined: () => void
}) {
  const [text, setText] = useState("")

  const mutation = useMutation({
    mutationFn: async (userText: string) => {
      const res = await fetch(`/api/meals/${mealId}/refine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userText }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          message?: string
        }
        throw new Error(body.message ?? body.error ?? "refine_failed")
      }
      return res.json()
    },
    onSuccess: () => {
      setText("")
      onRefined()
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    mutation.mutate(trimmed)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="ring-foreground/10 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1"
    >
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Refine the estimate
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Add anything the photo didn't capture — portion size, ingredients,
          prep method.
        </p>
      </div>

      {clarifications.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {clarifications.map((q) => (
            <li
              key={q.id}
              className="text-muted-foreground text-xs leading-snug before:mr-1.5 before:content-['•']"
            >
              {q.question}
            </li>
          ))}
        </ul>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. The chicken was closer to 200g and there's no olive oil."
        rows={3}
        disabled={mutation.isPending}
        className="border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <Button
        type="submit"
        disabled={mutation.isPending || text.trim().length === 0}
      >
        {mutation.isPending ? "Refining…" : "Refine with AI"}
      </Button>

      {mutation.isError && (
        <p className="text-destructive text-xs">
          Couldn't refine. {mutation.error?.message ?? ""}
        </p>
      )}
    </form>
  )
}
