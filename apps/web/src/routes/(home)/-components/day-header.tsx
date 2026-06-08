import { ChevronLeft, ChevronRight } from "lucide-react"

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
        <ChevronLeft className="size-5" strokeWidth={2.5} />
      </Button>
      <h1 className="font-heading text-base font-semibold">{label}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next week"
      >
        <ChevronRight className="size-5" strokeWidth={2.5} />
      </Button>
    </header>
  )
}
