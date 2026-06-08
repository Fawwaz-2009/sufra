import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { copyPasswordLinkMessage } from "../-helpers"
import { adminMembersKey } from "../-queries"

export function AddMemberForm() {
  const [newUsername, setNewUsername] = useState("")
  const queryClient = useQueryClient()

  const addMember = useMutation({
    mutationFn: async (username: string) => {
      const res = await api.api.admin.members.$post({ json: { username } })
      const json = await res.json()
      if (!res.ok || "error" in json) {
        const err = "error" in json ? json.error : "failed_to_add_member"
        throw new Error(err)
      }
      return json
    },
    onSuccess: async (data) => {
      await copyPasswordLinkMessage(
        data.member.username ?? "",
        data.passwordLink.token
      )
      setNewUsername("")
      queryClient.invalidateQueries({ queryKey: adminMembersKey })
    },
    onError: (e) => {
      const code = e instanceof Error ? e.message : "failed_to_add_member"
      toast.error(
        code === "username_taken"
          ? "That username is already taken."
          : "Couldn't add member. Try again."
      )
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
