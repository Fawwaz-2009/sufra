import { useState } from "react"
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { Trash } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { mealDetailKey } from "../-queries"

export function DeleteMealButton({ mealId }: { mealId: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const navigate = useNavigate()

  // Disable the page-level Delete button while any other meal-scoped mutation
  // is in flight (override save, refine, bookmark toggle). Each of those
  // mutations tags itself with `mutationKey: ["meal", mealId]`, so this scoped
  // counter only reflects this meal's pending work — not unrelated app-wide
  // activity. The destructive action waits its turn.
  const pendingCount = useIsMutating({ mutationKey: ["meal", mealId] })

  const deleteMutation = useMutation({
    mutationKey: ["meal", mealId],
    mutationFn: async () => {
      const res = await api.api.meals[":id"].$delete({ param: { id: mealId } })
      if (!res.ok) throw new Error("delete_failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: mealDetailKey(mealId) })
      queryClient.invalidateQueries({ queryKey: ["meals"] })
      setOpen(false)
      // Return to wherever the Member came from (Day view, Profile's Saved
      // Meals list). Fall back to "/" if there's no history (deep link).
      if (router.history.canGoBack()) router.history.back()
      else void navigate({ to: "/" })
      toast.success("Meal deleted")
    },
    onError: () => {
      toast.error("Couldn't delete. Try again.")
    },
  })

  // The page-level button counts ITS OWN pending mutation in pendingCount, so
  // we treat anything beyond that as "another meal op is in flight."
  const otherMutationPending = pendingCount > (deleteMutation.isPending ? 1 : 0)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/40"
        disabled={otherMutationPending || deleteMutation.isPending}
        onClick={() => setOpen(true)}
      >
        <Trash className="size-4" strokeWidth={2.5} />
        Delete meal
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meal?</AlertDialogTitle>
            <AlertDialogDescription>
              The photo and estimate will be permanently removed. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate()
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
