import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { getClient, run } from "@/client/api-client"
import { adminMembersKey, type Member } from "../-queries"

export function DeleteMemberDialog({
  member,
  onOpenChange,
}: {
  member: Member | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) =>
      run((await getClient()).members.destroy({ params: { id: memberId } })),
    onSuccess: () => {
      toast.success(`${member?.username ?? "Member"} deleted.`)
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: adminMembersKey })
    },
    onError: () => toast.error("Couldn't delete. Try again."),
  })

  return (
    <AlertDialog
      open={member !== null}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {member?.username}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes {member?.username} and everything they logged — meals,
            photos, weights. Inference cost stays on the books. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMember.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMember.isPending}
            onClick={(e) => {
              e.preventDefault()
              if (member) deleteMember.mutate(member.id)
            }}
          >
            {deleteMember.isPending
              ? "Deleting…"
              : `Delete ${member?.username} and everything they logged`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
