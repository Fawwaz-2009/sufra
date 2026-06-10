import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { deriveProfile } from "@/worker/views/derive"

// Common chrome for every Profile field-edit sheet: a title, the field-
// specific inputs, the "starts tomorrow" affordance (ADR 0002), and the
// Cancel / Save buttons with their disabled / saving states.
export function SheetShell({
  title,
  children,
  onSave,
  saving,
  disabled,
}: {
  title: string
  children: ReactNode
  onSave: () => void
  saving: boolean
  disabled: boolean
}) {
  return (
    <SheetContent>
      <SheetTitle>{title}</SheetTitle>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
      <p className="mt-4 rounded-md bg-foreground/5 px-3 py-2 text-xs text-muted-foreground">
        Starts tomorrow at midnight (your local time).
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
        <Button onClick={onSave} disabled={disabled || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </SheetContent>
  )
}

// Live preview of derived target + macros for the draft inputs. Renders
// alongside every sheet so the Member can see the effect of their edit
// before committing.
export function PreviewBox({
  inputs,
  previousTarget,
}: {
  inputs: Parameters<typeof deriveProfile>[0]
  previousTarget: number
}) {
  const derived = deriveProfile(inputs)
  const changed = derived.targetKcal !== previousTarget
  return (
    <div className="rounded-md bg-foreground/5 p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Daily target
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">
        {derived.targetKcal}
        <span className="ms-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
        {changed && (
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            was {previousTarget}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        P {derived.macros.proteinG}g · C {derived.macros.carbsG}g · F{" "}
        {derived.macros.fatG}g
      </p>
    </div>
  )
}
