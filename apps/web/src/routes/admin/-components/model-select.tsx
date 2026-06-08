import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { getClient, run } from "@/client/api-client"
import { cn } from "@/lib/utils"
import { MODELS } from "@/worker/estimator/models"
import { settingsQueryOptions } from "../-queries"
import { Section } from "./section"

export function ModelSelect() {
  const settings = useSuspenseQuery(settingsQueryOptions()).data
  const queryClient = useQueryClient()

  const patchSettings = useMutation({
    mutationFn: async (input: { visionModelId: string }) =>
      run((await getClient()).settings.update({ payload: input })),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsQueryOptions().queryKey, next)
      const model = MODELS.find((m) => m.id === next.visionModelId)
      toast.success(`Vision model updated → ${model?.label ?? next.visionModelId}.`)
    },
    onError: () => toast.error("Couldn't update model. Try again."),
  })

  return (
    <Section title="Vision Model">
      <ul className="flex flex-col gap-2">
        {MODELS.map((m) => {
          const selected = settings.visionModelId === m.id
          const pending =
            patchSettings.isPending &&
            patchSettings.variables?.visionModelId === m.id
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() =>
                  patchSettings.mutate({ visionModelId: m.id })
                }
                disabled={patchSettings.isPending || selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-start ring-1 ring-foreground/10 transition-colors",
                  selected && "ring-2 ring-foreground/40",
                  !selected && "hover:bg-card/80"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    ${m.pricing.inputPerMTokens.toFixed(2)} in / $
                    {m.pricing.outputPerMTokens.toFixed(2)} out per 1M tok
                  </p>
                </div>
                <span
                  className={cn(
                    "size-4 shrink-0 rounded-full ring-1 ring-foreground/30",
                    selected && "bg-foreground ring-foreground",
                    pending && "animate-pulse"
                  )}
                  aria-hidden
                />
              </button>
            </li>
          )
        })}
      </ul>
      {patchSettings.isError && (
        <p className="mt-2 text-sm text-destructive">
          Couldn't save. Try again.
        </p>
      )}
    </Section>
  )
}
