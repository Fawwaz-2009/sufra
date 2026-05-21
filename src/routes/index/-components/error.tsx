import { DayShell } from "./day-shell"

export function DayViewError({ error }: { error: Error }) {
  return (
    <DayShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-medium">Couldn't load your day.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </DayShell>
  )
}
