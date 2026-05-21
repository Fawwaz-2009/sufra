import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import type {
  MealDetail,
  MealOverride,
  MealOverridePatchInput,
} from "../../../../../worker/meals/schema"
import {
  resolveTotals,
  type ResolvedTotals,
} from "../../../../../worker/meals/isomorphic/totals"
import { OverrideField } from "./override-field"

export function OverrideEditor({
  meal,
  aiSum,
  onSaved,
}: {
  meal: MealDetail
  aiSum: ResolvedTotals
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<keyof MealOverride, string>>(() =>
    overrideToInputs(meal.override)
  )

  const mutation = useMutation({
    mutationFn: async (patch: MealOverridePatchInput) => {
      const res = await fetch(`/api/meals/${meal.id}/override`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("save_failed")
      return res.json()
    },
    onSuccess: (_data, patch) => {
      setDraft(patchToInputs(patch))
      onSaved()
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(inputsToPatch(draft))
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
          onClick={() =>
            setDraft({ kcal: "", proteinG: "", carbsG: "", fatG: "" })
          }
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

function overrideToInputs(
  override: MealOverride | null
): Record<keyof MealOverride, string> {
  return {
    kcal: override?.kcal != null ? String(override.kcal) : "",
    proteinG: override?.proteinG != null ? String(override.proteinG) : "",
    carbsG: override?.carbsG != null ? String(override.carbsG) : "",
    fatG: override?.fatG != null ? String(override.fatG) : "",
  }
}

// Build the PATCH body from the editor inputs. Empty input → explicit `null`
// so the server clears that field. (Server PATCH semantics: absent key is
// "leave alone"; null is "clear" — see worker/meals/operations.ts setOverride.
// Skipping empty fields here would silently preserve a prior override.)
function inputsToPatch(
  draft: Record<keyof MealOverride, string>
): MealOverridePatchInput {
  const out: MealOverridePatchInput = {}
  for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
    const raw = draft[k].trim()
    if (raw === "") {
      out[k] = null
      continue
    }
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) out[k] = n
  }
  return out
}

function patchToInputs(
  patch: MealOverridePatchInput
): Record<keyof MealOverride, string> {
  return {
    kcal: typeof patch.kcal === "number" ? String(patch.kcal) : "",
    proteinG: typeof patch.proteinG === "number" ? String(patch.proteinG) : "",
    carbsG: typeof patch.carbsG === "number" ? String(patch.carbsG) : "",
    fatG: typeof patch.fatG === "number" ? String(patch.fatG) : "",
  }
}
