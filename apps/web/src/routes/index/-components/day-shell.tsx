import type { ReactNode } from "react"

export function DayShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background">
      {children}
    </div>
  )
}
