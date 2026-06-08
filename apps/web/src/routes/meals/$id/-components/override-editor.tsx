import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { getClient, run } from "@/client/api-client"
import type { MealView } from "@/worker/views/meal"
import type { MealOverride } from "@/worker/models/meal-analysis"
import { resolveTotals, type ResolvedTotals } from "@/worker/views/meal"
import { OverrideField } from "./override-field"

type OverrideKey = "kcal" | "proteinG" | "carbsG" | "fatG"
const KEYS: ReadonlyArray<OverrideKey> = ["kcal", "proteinG", "carbsG", "fatG"]

export function OverrideEditor({
  meal,
  aiSum,
  onSaved,
}: {
  meal: MealView
  aiSum: ResolvedTotals
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<OverrideKey, string>>(() =>
    overrideToInputs(meal.override)
  )

  const mutation = useMutation({
    mutationKey: ["meal", meal.id],
    mutationFn: async (override: MealOverride) => {
      const client = await getClient()
      // PUT-replace when anything is set; DELETE-reset when the whole override is empty (ADR 0012 —
      // the override IS what you send, so there is no null-vs-absent ambiguity to mishandle).
      if (Object.keys(override).length === 0) {
        return run(client.override.destroy({ params: { id: meal.id } }))
      }
      return run(client.override.update({ params: { id: meal.id }, payload: override }))
    },
    onSuccess: (_data, override) => {
      setDraft(overrideToInputs(override))
      onSaved()
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(inputsToOverride(draft))
  }

  const resolved = resolveTotals(meal.aiAnalysis, meal.override)

  return (
    <form
      onSubmit={onSubmit}
      className="ring-foreground/10 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your numbers
        </h2>
        <p className="text-2xl font-semibold tabular-nums">
          {Math.round(resolved.kcal)}{" "}
          <span className="text-muted-foreground text-sm font-normal">
            kcal
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OverrideField
          label="Calories"
          unit="kcal"
          value={draft.kcal}
          aiValue={aiSum.kcal}
          onChange={(v) => setDraft((d) => ({ ...d, kcal: v }))}
        />
        <OverrideField
          label="Protein"
          unit="g"
          value={draft.proteinG}
          aiValue={aiSum.proteinG}
          onChange={(v) => setDraft((d) => ({ ...d, proteinG: v }))}
        />
        <OverrideField
          label="Carbs"
          unit="g"
          value={draft.carbsG}
          aiValue={aiSum.carbsG}
          onChange={(v) => setDraft((d) => ({ ...d, carbsG: v }))}
        />
        <OverrideField
          label="Fat"
          unit="g"
          value={draft.fatG}
          aiValue={aiSum.fatG}
          onChange={(v) => setDraft((d) => ({ ...d, fatG: v }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft({ kcal: "", proteinG: "", carbsG: "", fatG: "" })}
          disabled={mutation.isPending}
        >
          Reset
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-destructive text-xs">Couldn't save. Try again.</p>
      )}
    </form>
  )
}

function overrideToInputs(override: MealOverride | null): Record<OverrideKey, string> {
  return {
    kcal: override?.kcal != null ? String(override.kcal) : "",
    proteinG: override?.proteinG != null ? String(override.proteinG) : "",
    carbsG: override?.carbsG != null ? String(override.carbsG) : "",
    fatG: override?.fatG != null ? String(override.fatG) : "",
  }
}

// Build the override from the editor inputs — only NON-empty, valid, non-negative fields. An empty
// field is OMITTED (PUT-replace semantics); an all-empty result triggers the DELETE reset in the
// mutation. This is the clean replacement for the old per-field null/absent PATCH dance.
function inputsToOverride(draft: Record<OverrideKey, string>): MealOverride {
  const out: { -readonly [K in OverrideKey]?: number } = {}
  for (const k of KEYS) {
    const raw = draft[k].trim()
    if (raw === "") continue
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) out[k] = n
  }
  return out
}
