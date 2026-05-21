import type { ReactNode } from "react"
import { CaretRight } from "@phosphor-icons/react"

export function SectionCard({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 divide-y divide-foreground/5">
        {children}
      </div>
    </section>
  )
}

export function Row({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-foreground/[0.02]"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        <CaretRight className="size-3.5" weight="bold" />
      </span>
    </button>
  )
}
