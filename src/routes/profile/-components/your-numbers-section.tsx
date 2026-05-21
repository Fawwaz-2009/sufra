import { Link } from "@tanstack/react-router"
import { Info } from "@phosphor-icons/react"

import { SectionCard } from "./section-card"

export function YourNumbersSection({
  targetKcal,
  macros,
  hasPending,
}: {
  targetKcal: number
  macros: { proteinG: number; carbsG: number; fatG: number }
  hasPending: boolean
}) {
  return (
    <SectionCard label="Your numbers">
      <div className="flex flex-col gap-3 px-4 py-3">
        {hasPending && (
          <p className="rounded-md bg-foreground/5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Pending changes — starts tomorrow
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Daily target</span>
          <span className="text-2xl font-semibold tabular-nums">
            {targetKcal}
            <span className="ms-1 text-xs font-normal text-muted-foreground">
              kcal
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
          <MacroCell label="Protein" g={macros.proteinG} />
          <MacroCell label="Carbs" g={macros.carbsG} />
          <MacroCell label="Fat" g={macros.fatG} />
        </div>
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" /> How does this work?
        </Link>
      </div>
    </SectionCard>
  )
}

function MacroCell({ label, g }: { label: string; g: number }) {
  return (
    <div className="rounded-md bg-foreground/5 px-2 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-base font-medium">{g}g</p>
    </div>
  )
}
