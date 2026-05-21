import type { ReactNode } from "react"
import { Shield } from "@phosphor-icons/react"

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background">
      {children}
    </div>
  )
}

export function AdminHeader() {
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
