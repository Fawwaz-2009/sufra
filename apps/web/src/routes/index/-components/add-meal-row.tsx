import { BookmarkSimple, Camera } from "@phosphor-icons/react"

export function AddMealRow({
  uploading,
  onTakePhoto,
  onPickSaved,
}: {
  uploading: boolean
  onTakePhoto: () => void
  onPickSaved: () => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={uploading}
        onClick={onTakePhoto}
        className="ring-foreground/10 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground ring-1 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      >
        <Camera weight="bold" className="size-5" />
        {uploading ? "Uploading…" : "Take photo"}
      </button>
      <button
        type="button"
        onClick={onPickSaved}
        className="ring-foreground/10 flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium ring-1 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <BookmarkSimple weight="bold" className="size-5" />
        From saved
      </button>
    </div>
  )
}
