import { Bookmark } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getClient, run } from "@/client/api-client"
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
    mutationKey: ["meal", mealId],
    mutationFn: async () => {
      const client = await getClient()
      // POST save / DELETE unsave (ADR 0012's singular toggle), branching on the current state.
      return saved
        ? run(client.saved.destroy({ params: { id: mealId } }))
        : run(client.saved.create({ params: { id: mealId } }))
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
      <Bookmark
        className={cn(
          "size-5",
          saved ? "fill-current text-primary" : "text-muted-foreground",
        )}
      />
    </button>
  )
}
