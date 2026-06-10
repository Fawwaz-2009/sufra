import { AdminShell } from "./admin-shell"

export function AdminError({ error }: { error: Error }) {
  return (
    <AdminShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-medium">Couldn't load admin.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AdminShell>
  )
}
