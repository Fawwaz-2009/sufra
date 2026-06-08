import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { MealCard } from "@/components/meal-card"
import { savedMealsQueryOptions } from "@/routes/(home)/-queries"

export function SavedMealsSection() {
  const saved = useQuery(savedMealsQueryOptions())
  const meals = saved.data ?? []

  return (
    <section>
      <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Saved Meals
      </p>
      {saved.isLoading ? (
        <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Loading…
        </p>
      ) : meals.length === 0 ? (
        <div className="rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10">
          <p className="text-sm font-medium">No saved meals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the bookmark on any meal to save it for quick re-logging.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {meals.map((meal) => (
            <li key={meal.id}>
              <Link
                to="/meals/$id"
                params={{ id: meal.id }}
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <MealCard meal={meal} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
