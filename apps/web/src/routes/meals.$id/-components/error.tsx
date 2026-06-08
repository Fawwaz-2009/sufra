import { DetailShell } from "./detail-shell"

export function MealDetailError({ error }: { error: Error }) {
  return (
    <DetailShell>
      <div className="px-5 py-12 text-center">
        <p className="font-medium">Couldn't load this meal.</p>
        <p className="text-muted-foreground mt-1 text-sm">{error.message}</p>
      </div>
    </DetailShell>
  )
}
