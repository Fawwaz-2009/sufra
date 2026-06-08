import { AdminShell } from "./admin-shell"

export function AdminPending() {
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
    </AdminShell>
  )
}
