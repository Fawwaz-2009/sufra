import { Camera } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

export function CaptureFab({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-md justify-center bg-linear-to-t from-background via-background/80 to-transparent px-5 pt-8 pb-2">
      <Button
        size="lg"
        disabled={disabled}
        className="pointer-events-auto h-14 w-full max-w-xs gap-2 rounded-full text-base shadow-lg"
        onClick={onClick}
      >
        <Camera weight="bold" className="size-5" />
        {label}
      </Button>
    </div>
  )
}
