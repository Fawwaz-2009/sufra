import { CaretLeft, CaretRight } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

export function DayHeader({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  canGoNext: boolean
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 pt-4 pb-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        aria-label="Previous week"
      >
        <CaretLeft className="size-5" weight="bold" />
      </Button>
      <h1 className="font-heading text-base font-semibold">{label}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next week"
      >
        <CaretRight className="size-5" weight="bold" />
      </Button>
    </header>
  )
}
