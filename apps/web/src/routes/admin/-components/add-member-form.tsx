import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClient, run } from "@/client/api-client"
import { copyPasswordLinkMessage } from "../-helpers"
import { adminMembersKey } from "../-queries"

export function AddMemberForm() {
  const [newUsername, setNewUsername] = useState("")
  const queryClient = useQueryClient()

  const addMember = useMutation({
    // Member-create is pure (returns the Member); the Password link is a SEPARATE issue (ADR 0016). The add
    // flow chains them — provision, then issue a link — but the link is BEST-EFFORT: once the Member is
    // created they must show in the list and the create must NOT be retried (the username is now taken).
    // So a link-issuance failure doesn't fail the whole mutation; it returns `link: null` for onSuccess to
    // handle, and the 🔑 in the list re-issues.
    mutationFn: async (username: string) => {
      const client = await getClient()
      const member = await run(client.members.create({ payload: { username } }))
      try {
        const link = await run(client.memberPasswordLink.create({ params: { id: member.id } }))
        return { member, link }
      } catch {
        return { member, link: null }
      }
    },
    onSuccess: async ({ member, link }) => {
      setNewUsername("")
      queryClient.invalidateQueries({ queryKey: adminMembersKey }) // the Member is created — always reveal it
      if (link) {
        await copyPasswordLinkMessage(member.username, link.token)
      } else {
        toast.message(`${member.username} added — but the link didn't generate. Tap the 🔑 to retry.`)
      }
    },
    onError: (e) => {
      // Reached only when member-CREATE itself failed (e.g. UsernameTaken — its typed message is human).
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't add member. Try again.")
    },
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const username = newUsername.trim()
    if (username.length < 3) return
    addMember.mutate(username)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex gap-2">
      <Input
        placeholder="username"
        value={newUsername}
        onChange={(e) => setNewUsername(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={addMember.isPending || newUsername.trim().length < 3}
      >
        {addMember.isPending ? "Adding…" : "Add Member"}
      </Button>
    </form>
  )
}
