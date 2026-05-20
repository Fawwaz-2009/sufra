import { useState, type FormEvent } from "react"
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
} from "@tanstack/react-router"
import { ArrowLeft, Sparkle } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type Override = {
  kcal?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

type MealDetailData = {
  id: string
  capturedAt: string
  aiAnalysis: {
    dishName: string
    foods: Array<{
      name: string
      portionGrams: number
      portionEstimate: number
      portionUnit: string
      estimatedKcal: number
      estimatedProteinG: number
      estimatedCarbsG: number
      estimatedFatG: number
      confidence: "high" | "medium" | "low"
    }>
    clarifications: Array<{
      id: string
      question: string
      type: "binary" | "choice" | "scale"
      options: string[]
    }>
    overallConfidence: "high" | "medium" | "low"
  }
  override: Override | null
}

const CONFIDENCE_STYLES: Record<"high" | "medium" | "low", string> = {
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
    queryClient.invalidateQueries({ queryKey: ["meal", id] })
    queryClient.invalidateQueries({ queryKey: ["meals"] })
  }

  return (
    <DetailShell>
      <PhotoHero mealId={id} />
      <DetailBody meal={meal} onSaved={onSaved} />
    </DetailShell>
  )
}

function mealQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["meal", id] as const,
    queryFn: async (): Promise<MealDetailData | null> => {
      const res = await api.api.meals[":id"].$get({ param: { id } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error("failed_to_load_meal")
      return (await res.json()) as MealDetailData
    },
  })
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background mx-auto flex min-h-svh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 px-3 pt-3 pb-2 backdrop-blur">
        <Link
          to="/"
          aria-label="Back"
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </header>
      {children}
    </div>
  )
}

function PhotoHero({ mealId }: { mealId: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="bg-muted relative mx-5 aspect-square overflow-hidden rounded-2xl">
      {failed ? (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          No photo
        </div>
      ) : (
        <img
          src={`/api/meals/${mealId}/photo`}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

function DetailBody({
  meal,
  onSaved,
}: {
  meal: MealDetailData
  onSaved: () => void
}) {
  const ai = meal.aiAnalysis
  const time = new Date(meal.capturedAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  const aiSum = sumFoods(ai.foods)

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-12">
      <div>
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
      </div>

      <OverrideEditor meal={meal} aiSum={aiSum} onSaved={onSaved} />

      <RefineSection
        mealId={meal.id}
        clarifications={ai.clarifications}
        onRefined={onSaved}
      />

      <AiBreakdown foods={ai.foods} />
    </div>
  )
}

function OverrideEditor({
  meal,
  aiSum,
  onSaved,
}: {
  meal: MealDetailData
  aiSum: Totals
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<keyof Override, string>>(() =>
    overrideToInputs(meal.override)
  )

  const mutation = useMutation({
    mutationFn: async (next: Override) => {
      const res = await fetch(`/api/meals/${meal.id}/override`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error("save_failed")
      return res.json()
    },
    onSuccess: (_data, saved) => {
      setDraft(overrideToInputs(saved))
      onSaved()
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next = inputsToOverride(draft)
    mutation.mutate(next)
  }

  const resolved: Totals = {
    kcal: meal.override?.kcal ?? aiSum.kcal,
    proteinG: meal.override?.proteinG ?? aiSum.proteinG,
    carbsG: meal.override?.carbsG ?? aiSum.carbsG,
    fatG: meal.override?.fatG ?? aiSum.fatG,
  }

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
          <span className="text-muted-foreground text-sm font-normal">kcal</span>
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

function OverrideField({
  label,
  unit,
  value,
  aiValue,
  onChange,
}: {
  label: string
  unit: string
  value: string
  aiValue: number
  onChange: (v: string) => void
}) {
  const id = `field-${label.toLowerCase()}`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(Math.round(aiValue))}
          className="pr-10 tabular-nums"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
          {unit}
        </span>
      </div>
      <p className="text-muted-foreground text-[10px]">
        AI: {Math.round(aiValue)} {unit}
      </p>
    </div>
  )
}

function RefineSection({
  mealId,
  clarifications,
  onRefined,
}: {
  mealId: string
  clarifications: NonNullable<MealDetailData["aiAnalysis"]>["clarifications"]
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
          Add anything the photo didn't capture — portion size, ingredients, prep method.
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

function AiBreakdown({
  foods,
}: {
  foods: NonNullable<MealDetailData["aiAnalysis"]>["foods"]
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
                {f.portionEstimate} {f.portionUnit} · {Math.round(f.portionGrams)}g
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

function MealDetailPending() {
  return (
    <DetailShell>
      <div className="flex flex-col gap-6 px-5 py-4">
        <div className="bg-muted aspect-square animate-pulse rounded-2xl" />
        <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-40 animate-pulse rounded-xl" />
      </div>
    </DetailShell>
  )
}

function MealNotFound() {
  return (
    <DetailShell>
      <div className="px-5 py-12 text-center">
        <p className="font-medium">Meal not found.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          It may have been deleted.
        </p>
      </div>
    </DetailShell>
  )
}

function MealDetailError({ error }: { error: Error }) {
  return (
    <DetailShell>
      <div className="px-5 py-12 text-center">
        <p className="font-medium">Couldn't load this meal.</p>
        <p className="text-muted-foreground mt-1 text-sm">{error.message}</p>
      </div>
    </DetailShell>
  )
}

type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number }

function sumFoods(
  foods: NonNullable<MealDetailData["aiAnalysis"]>["foods"]
): Totals {
  return foods.reduce<Totals>(
    (acc, f) => ({
      kcal: acc.kcal + f.estimatedKcal,
      proteinG: acc.proteinG + f.estimatedProteinG,
      carbsG: acc.carbsG + f.estimatedCarbsG,
      fatG: acc.fatG + f.estimatedFatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )
}

function overrideToInputs(
  override: Override | null
): Record<keyof Override, string> {
  return {
    kcal: override?.kcal != null ? String(override.kcal) : "",
    proteinG: override?.proteinG != null ? String(override.proteinG) : "",
    carbsG: override?.carbsG != null ? String(override.carbsG) : "",
    fatG: override?.fatG != null ? String(override.fatG) : "",
  }
}

function inputsToOverride(
  draft: Record<keyof Override, string>
): Override {
  const out: Override = {}
  for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
    const raw = draft[k].trim()
    if (raw === "") continue
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) out[k] = n
  }
  return out
}
