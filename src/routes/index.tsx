import { useRef, type ChangeEvent } from "react"
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { Camera, SignOut } from "@phosphor-icons/react"

import { MealCard, type MealCardData } from "@/components/meal-card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { todayRangeUtc } from "@/lib/date"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    return { session: context.session }
  },
  loader: ({ context }) => {
    const { from, to } = todayRangeUtc()
    return context.queryClient.ensureQueryData(mealsListQueryOptions(from, to))
  },
  pendingComponent: DayViewPending,
  errorComponent: DayViewError,
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = Route.useRouteContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const range = todayRangeUtc()
  const data = useSuspenseQuery(mealsListQueryOptions(range.from, range.to)).data
  const meals = (data.meals ?? []) as MealCardData[]

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("photo", file)
      const res = await fetch("/api/meals", { method: "POST", body: formData })
      if (!res.ok) {
        const body = (await res
          .json<{ error?: string }>()
          .catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "upload_failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
    },
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ""
  }

  const signOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <DayShell>
      <DayHeader username={session.user.username ?? ""} onSignOut={signOut} />

      <main className="flex-1 px-5 pb-32">
        <section>
          <h2 className="text-muted-foreground mt-6 mb-3 text-xs font-medium tracking-wider uppercase">
            Meals
          </h2>
          {meals.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-3">
              {meals.map((meal) => (
                <li key={meal.id}>
                  <Link
                    to="/meals/$id"
                    params={{ id: meal.id }}
                    className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl"
                  >
                    <MealCard meal={meal} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {uploadMutation.isError && (
            <p className="text-destructive mt-3 text-sm">
              Couldn't upload that photo. Try again.
            </p>
          )}
        </section>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <CaptureFab
        disabled={uploadMutation.isPending}
        label={uploadMutation.isPending ? "Uploading…" : "Log a meal"}
        onClick={() => fileInputRef.current?.click()}
      />
    </DayShell>
  )
}

function mealsListQueryOptions(from: string, to: string) {
  return queryOptions({
    queryKey: ["meals", from, to] as const,
    queryFn: async () => {
      const res = await api.api.meals.$get({ query: { from, to } })
      if (!res.ok) throw new Error("failed_to_load_meals")
      return res.json()
    },
  })
}

function DayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background mx-auto flex min-h-svh max-w-md flex-col">
      {children}
    </div>
  )
}

function DayHeader({
  username,
  onSignOut,
}: {
  username: string
  onSignOut: () => void
}) {
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider">
          Today
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </h1>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        aria-label={`Sign out ${username}`}
      >
        <SignOut className="size-5" />
      </Button>
    </header>
  )
}

function CaptureFab({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md justify-center bg-gradient-to-t from-background via-background/80 to-transparent px-5 pt-8 pb-6">
      <Button
        size="lg"
        disabled={disabled}
        className="pointer-events-auto h-14 w-full max-w-xs gap-2 rounded-full text-base shadow-lg"
        onClick={onClick}
      >
        <Camera weight="bold" className="size-5" />
        {label}
      </Button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="ring-foreground/10 flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1">
      <p className="font-medium">No meals logged yet</p>
      <p className="text-muted-foreground text-sm">
        Tap <span className="font-medium">Log a meal</span> to photograph your
        first one.
      </p>
    </div>
  )
}

function DayViewPending() {
  return (
    <DayShell>
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="space-y-1">
          <div className="bg-muted h-3 w-10 animate-pulse rounded" />
          <div className="bg-muted h-7 w-44 animate-pulse rounded" />
        </div>
      </header>
      <main className="flex-1 px-5 pb-32">
        <h2 className="text-muted-foreground mt-6 mb-3 text-xs font-medium tracking-wider uppercase">
          Meals
        </h2>
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="ring-foreground/10 flex items-center gap-4 rounded-xl bg-card p-3 ring-1"
            >
              <div className="bg-muted size-20 shrink-0 animate-pulse rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                <div className="bg-muted h-6 w-1/3 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </DayShell>
  )
}

function DayViewError({ error }: { error: Error }) {
  return (
    <DayShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-medium">Couldn't load your day.</p>
        <p className="text-muted-foreground mt-1 text-sm">{error.message}</p>
      </div>
    </DayShell>
  )
}
