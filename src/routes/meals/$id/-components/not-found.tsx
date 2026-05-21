import { DetailShell } from "./detail-shell"

export function MealNotFound() {
  return (
    <DetailShell>
      <div className="px-5 py-12 text-center">
        <p className="font-medium">Meal not found.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          It may have been deleted.
        </p>
      </div>
    </DetailShell>
  )
}
