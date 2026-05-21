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
import { api } from "@/lib/api"
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
    mutationFn: async (memberId: string) => {
      const res = await api.api.admin.members[":id"].$delete({
        param: { id: memberId },
      })
      if (!res.ok) throw new Error("failed_to_delete_member")
    },
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
              : `Delete ${member?.username} and everything she logged`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
