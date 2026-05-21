import type { ReactNode } from "react"
import { CaretLeft } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background px-6 py-6">
      {children}
    </div>
  )
}

export function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={cn(disabled && "invisible")}
      aria-label="Back"
    >
      <CaretLeft className="size-5" weight="bold" />
    </Button>
  )
}

export function Dots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full transition-colors",
            i + 1 <= current ? "bg-foreground" : "bg-foreground/20"
          )}
        />
      ))}
    </div>
  )
}
