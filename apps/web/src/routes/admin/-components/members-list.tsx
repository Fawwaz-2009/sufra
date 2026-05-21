import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Key, Trash } from "@phosphor-icons/react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { copyPasswordLinkMessage } from "../-helpers"
import { membersQueryOptions, type Member } from "../-queries"

export function MembersList({
  onDelete,
}: {
  onDelete: (member: Member) => void
}) {
  const members = useSuspenseQuery(membersQueryOptions()).data

  const generateLink = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await api.api.admin.members[":id"]["password-link"].$post({
        param: { id: memberId },
      })
      const json = await res.json()
      if (!res.ok || "error" in json) {
        throw new Error("failed_to_generate_link")
      }
      return json
    },
    onSuccess: async (data, memberId) => {
      const m = members.members.find((m) => m.id === memberId)
      await copyPasswordLinkMessage(
        m?.username ?? "",
        data.passwordLink.token
      )
    },
    onError: () => toast.error("Couldn't copy link. Try again."),
  })

  if (members.members.length === 0) {
    return (
      <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No Members yet. Add one above.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.members.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
        >
          <span className="size-8 shrink-0 rounded-full bg-foreground/10" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {m.username}
          </span>
          <button
            type="button"
            aria-label={`Copy password link for ${m.username}`}
            onClick={() => generateLink.mutate(m.id)}
            disabled={
              generateLink.isPending && generateLink.variables === m.id
            }
            className="rounded-full p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
          >
            <Key className="size-5" weight="bold" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${m.username}`}
            onClick={() => onDelete(m)}
            className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash className="size-5" weight="bold" />
          </button>
        </li>
      ))}
    </ul>
  )
}
