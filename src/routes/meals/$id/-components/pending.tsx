import { DetailShell } from "./detail-shell"

export function MealDetailPending() {
  return (
    <DetailShell>
      <div className="flex flex-col gap-6 px-5 py-4">
        <div className="bg-muted aspect-square animate-pulse rounded-2xl" />
        <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-40 animate-pulse rounded-xl" />
      </div>
    </DetailShell>
  )
}
