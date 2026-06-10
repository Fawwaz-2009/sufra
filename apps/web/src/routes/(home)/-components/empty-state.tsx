export function EmptyState({ isToday }: { isToday: boolean }) {
  if (isToday) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
        <p className="font-medium">No meals logged yet</p>
        <p className="text-sm text-muted-foreground">
          Tap <span className="font-medium">Log a meal</span> to photograph
          your first one.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      <p className="font-medium">No meals logged this day.</p>
    </div>
  )
}
