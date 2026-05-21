import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { MODELS } from "../../../../worker/meals/isomorphic/models"
import { settingsQueryOptions } from "../-queries"
import { Section } from "./section"

export function ModelSelect() {
  const settings = useSuspenseQuery(settingsQueryOptions()).data
  const queryClient = useQueryClient()

  const patchSettings = useMutation({
    mutationFn: async (input: { visionModelId: string }) => {
      const res = await api.api.admin.settings.$patch({ json: input })
      if (!res.ok) throw new Error("failed_to_update_settings")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
    onSuccess: (next) => {
      queryClient.setQueryData(settingsQueryOptions().queryKey, next)
    },
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
