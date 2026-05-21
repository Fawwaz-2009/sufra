import { useState, type FormEvent } from "react"
import { CurrencyDollar, Key, Shield, Trash } from "@phosphor-icons/react"
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { toast } from "sonner"

import { BottomNav } from "@/components/bottom-nav"
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
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { MODELS } from "../../worker/meals/isomorphic/models"

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    if (context.session.user.role !== "host") throw redirect({ to: "/" })
    return { session: context.session }
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        inferenceCostQueryOptions(monthRangeUtc())
      ),
      context.queryClient.ensureQueryData(settingsQueryOptions()),
      context.queryClient.ensureQueryData(membersQueryOptions()),
    ]),
  pendingComponent: AdminPending,
  errorComponent: AdminError,
  component: Admin,
})

type Member = {
  id: string
  username: string | null
  createdAt: string
}

const PASSWORD_LINK_TOAST_MS = 6000

function Admin() {
  const range = monthRangeUtc()
  const cost = useSuspenseQuery(inferenceCostQueryOptions(range)).data
  const settings = useSuspenseQuery(settingsQueryOptions()).data
  const members = useSuspenseQuery(membersQueryOptions()).data

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

  const [newUsername, setNewUsername] = useState("")
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: membersQueryOptions().queryKey })

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
      await copyPasswordLinkMessage(data.member.username ?? "", data.passwordLink.token)
      setNewUsername("")
      invalidateMembers()
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
      await copyPasswordLinkMessage(m?.username ?? "", data.passwordLink.token)
    },
    onError: () => toast.error("Couldn't copy link. Try again."),
  })

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await api.api.admin.members[":id"].$delete({
        param: { id: memberId },
      })
      if (!res.ok) throw new Error("failed_to_delete_member")
    },
    onSuccess: (_, memberId) => {
      const m = members.members.find((m) => m.id === memberId)
      toast.success(`${m?.username ?? "Member"} deleted.`)
      setMemberToDelete(null)
      invalidateMembers()
    },
    onError: () => toast.error("Couldn't delete. Try again."),
  })

  const handleAddSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const username = newUsername.trim()
    if (username.length < 3) return
    addMember.mutate(username)
  }

  return (
    <AdminShell>
      <AdminHeader />

      <main className="flex-1 px-5 pb-32">
        <CostCard
          totalUsd={cost.totalUsd}
          perMemberAvgUsd={cost.perMemberAvgUsd}
          runCount={cost.runCount}
        />

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

        <Section title="Members">
          <form onSubmit={handleAddSubmit} className="mb-3 flex gap-2">
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

          {members.members.length === 0 ? (
            <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              No Members yet. Add one above.
            </p>
          ) : (
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
                    onClick={() => setMemberToDelete(m)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash className="size-5" weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>

      <AlertDialog
        open={memberToDelete !== null}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {memberToDelete?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {memberToDelete?.username} and everything they
              logged — meals, photos, weights. Inference cost stays on the
              books. This cannot be undone.
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
                if (memberToDelete) deleteMember.mutate(memberToDelete.id)
              }}
            >
              {deleteMember.isPending
                ? "Deleting…"
                : `Delete ${memberToDelete?.username} and everything she logged`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </AdminShell>
  )
}

function membersQueryOptions() {
  return queryOptions({
    queryKey: ["admin", "members"] as const,
    queryFn: async () => {
      const res = await api.api.admin.members.$get()
      if (!res.ok) throw new Error("failed_to_load_members")
      const json = await res.json()
      if ("error" in json) throw new Error(String(json.error))
      return json
    },
  })
}

// Build and copy the share message; toast confirms with the 24h TTL surfaced
// per the design — Host pastes anywhere (WhatsApp, iMessage, group chat).
async function copyPasswordLinkMessage(username: string, token: string) {
  const url = `${window.location.origin}/set-password/${token}`
  const message = `Hi ${username}, here's your link to join Sufra:\n${url}`
  const copied = await copyText(message)
  if (copied) {
    toast.success(
      `Password link copied. Expires in 24h. Send it to ${username}.`,
      { duration: PASSWORD_LINK_TOAST_MS }
    )
  } else {
    toast.message("Couldn't access clipboard.", {
      description: message,
      duration: 20000,
    })
  }
}

// Modern Clipboard API requires a secure context (HTTPS / localhost). When
// dogfooding the dev server from a phone over LAN IP, the page is plain HTTP
// and the modern API throws. Fall through to the legacy execCommand path —
// deprecated but still supported across mobile browsers — so the host can
// actually copy the link during local testing.
async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy path
    }
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "0"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

function inferenceCostQueryOptions(range: { from: string; to: string }) {
  return queryOptions({
    queryKey: ["admin", "inference-cost", range.from, range.to] as const,
    queryFn: async () => {
      const res = await api.api.admin["inference-cost"].$get({
        query: { from: range.from, to: range.to },
      })
      if (!res.ok) throw new Error("failed_to_load_cost")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

function settingsQueryOptions() {
  return queryOptions({
    queryKey: ["admin", "settings"] as const,
    queryFn: async () => {
      const res = await api.api.admin.settings.$get()
      if (!res.ok) throw new Error("failed_to_load_settings")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

// Current calendar month in the Host's local TZ, mapped to UTC instants for
// the server-side BETWEEN. Same pattern as the Day view's weekRange — TZ logic
// lives on the client, server only sees a UTC range.
function monthRangeUtc(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background">
      {children}
    </div>
  )
}

function AdminHeader() {
  return (
    <header className="flex items-center gap-3 px-5 pt-6 pb-4">
      <Shield className="size-7" weight="bold" />
      <div>
        <h1 className="font-heading text-lg font-semibold">Admin</h1>
        <p className="text-xs text-muted-foreground">Host only</p>
      </div>
    </header>
  )
}

function CostCard({
  totalUsd,
  perMemberAvgUsd,
  runCount,
}: {
  totalUsd: number
  perMemberAvgUsd: number
  runCount: number
}) {
  return (
    <div className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <CurrencyDollar className="size-6 shrink-0" weight="bold" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Inference cost this month
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-heading text-2xl font-semibold tabular-nums">
              ${totalUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ~${perMemberAvgUsd.toFixed(2)} / member
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {runCount} {runCount === 1 ? "run" : "runs"}
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function AdminPending() {
  return (
    <AdminShell>
      <header className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="size-7 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <main className="flex-1 px-5">
        <div className="mb-6 h-24 animate-pulse rounded-xl bg-muted" />
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </main>
      <BottomNav />
    </AdminShell>
  )
}

function AdminError({ error }: { error: Error }) {
  return (
    <AdminShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-medium">Couldn't load admin.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
      <BottomNav />
    </AdminShell>
  )
}
