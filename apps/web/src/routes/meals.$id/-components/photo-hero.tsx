import { useState } from "react"

export function PhotoHero({ mealId }: { mealId: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="bg-muted relative mx-5 aspect-square overflow-hidden rounded-2xl">
      {failed ? (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          No photo
        </div>
      ) : (
        <img
          src={`/api/meals/${mealId}/photo`}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
