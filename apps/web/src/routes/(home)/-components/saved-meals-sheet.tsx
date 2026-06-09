import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { MealCard } from "@/components/meal-card"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { getClient, run } from "@/client/api-client"
import { savedMealsQueryOptions } from "../-queries"

export function SavedMealsSheet({
  open,
  onOpenChange,
  capturedAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // ISO string when cloning onto a past Day; undefined ⇒ server uses "now".
  // Same rule as the photo-upload past-Day path (localDateForCapture).
  capturedAt?: string
}) {
  const queryClient = useQueryClient()
  const saved = useQuery({ ...savedMealsQueryOptions(), enabled: open })

  const clone = useMutation({
    mutationFn: async (sourceMealId: string) =>
      run(
        (await getClient()).clones.create({
          params: { id: sourceMealId },
          payload: { ...(capturedAt ? { capturedAt } : {}) },
        })
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
      toast.success(`Added ~${Math.round(data.totals?.kcal ?? 0)} kcal — ${data.aiAnalysis?.dishName ?? "meal"}`)
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't add that meal. Try again.")
    },
  })

  const meals = saved.data ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[80vh] gap-4 pb-8">
        <SheetTitle>Pick a saved meal</SheetTitle>

        {saved.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : meals.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-medium">No saved meals yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the bookmark on any meal to save it for quick re-logging.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 overflow-y-auto">
            {meals.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={clone.isPending}
                  onClick={() => clone.mutate(m.id)}
                  className="block w-full rounded-xl text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  <MealCard meal={m} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
