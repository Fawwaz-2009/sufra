import { useEffect, useState } from "react"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type LoaderData = { username: string; familyName: string }

export const Route = createFileRoute("/set-password/$token")({
  loader: async ({ params }) => {
    const res = await api.api["set-password"][":token"].$get({
      param: { token: params.token },
    })
    if (!res.ok) throw notFound()
    const json = (await res.json()) as LoaderData | { error: string }
    if ("error" in json) throw notFound()
    return json
  },
  notFoundComponent: LinkInvalid,
  pendingComponent: SetPasswordPending,
  component: SetPassword,
})

function SetPassword() {
  const data = Route.useLoaderData()
  const auth = useAuth()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { token } = Route.useParams()

  // The link page is opened in a browser; we don't want search engines or
  // chat-app preview crawlers caching it anywhere.
  useEffect(() => {
    const tag = document.createElement("meta")
    tag.name = "robots"
    tag.content = "noindex,nofollow"
    document.head.appendChild(tag)
    return () => {
      document.head.removeChild(tag)
    }
  }, [])

  const validate = (): string | null => {
    if (password.length < 6) return "Password must be at least 6 characters."
    if (password !== confirm) return "Passwords don't match."
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) {
      setSubmitError(err)
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const res = await api.api["set-password"][":token"].$post({
        param: { token },
        json: { password },
      })
      if (!res.ok) {
        setSubmitError("Couldn't set your password. Try again.")
        return
      }
      // Cookie was set by the worker — refresh auth context, then navigate.
      await auth.refresh()
      window.location.assign("/")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Shell>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Welcome to the {data.familyName} Sufra, {data.username}
        </h1>
        <p className="text-sm text-muted-foreground">
          Set a password to start using Sufra.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="password">Password (6+ characters)</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {submitError && (
          <p className="text-xs text-destructive">{submitError}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Setting…" : "Start using Sufra →"}
        </Button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
    </div>
  )
}

function LinkInvalid() {
  return (
    <Shell>
      <h1 className="font-heading text-2xl font-semibold">Link unavailable</h1>
      <p className="text-sm text-muted-foreground">
        This link has expired or has already been used. Ask your Host for a new
        one.
      </p>
    </Shell>
  )
}

function SetPasswordPending() {
  return (
    <Shell>
      <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-10 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-10 animate-pulse rounded bg-muted" />
    </Shell>
  )
}
