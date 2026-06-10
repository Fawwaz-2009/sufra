import type { ReactNode } from "react"

import { BottomNav } from "@/components/bottom-nav"

export function DayShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-24">
      {children}
      <BottomNav />
    </div>
  )
}
