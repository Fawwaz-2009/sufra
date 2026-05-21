import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "@phosphor-icons/react"

// Shared chrome for the meal-detail route. Wraps the route component, the
// pending skeleton, the not-found state, and the error state so the back
// chevron is present regardless of which body renders.
export function DetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background mx-auto flex min-h-svh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 px-3 pt-3 pb-2 backdrop-blur">
        <Link
          to="/"
          aria-label="Back"
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </header>
      {children}
    </div>
  )
}
