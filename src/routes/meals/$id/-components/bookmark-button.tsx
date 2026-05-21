import { BookmarkSimple } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { mealDetailKey } from "../-queries"

export function BookmarkButton({
  mealId,
  saved,
}: {
  mealId: string
  saved: boolean
}) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: async () => {
      const res = await api.api.meals[":id"].saved.$patch({
        param: { id: mealId },
      })
      if (!res.ok) throw new Error("toggle_failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealDetailKey(mealId) })
      queryClient.invalidateQueries({ queryKey: ["meals", "saved"] })
      toast.success(saved ? "Removed from saved" : "Saved")
    },
    onError: () => {
      toast.error("Couldn't update. Try again.")
    },
  })

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved meals" : "Save for re-logging"}
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate()}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
        "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:opacity-50"
      )}
    >
      <BookmarkSimple
        weight={saved ? "fill" : "regular"}
        className={cn("size-5", saved ? "text-primary" : "text-muted-foreground")}
      />
    </button>
  )
}
