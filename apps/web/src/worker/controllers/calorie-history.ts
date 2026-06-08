import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { CalorieHistory } from "../domain/calorie-history.ts"

/** Calorie history — one thin line to the read-model. User-scoped (CurrentUser via the api-wide auth). */
export const CalorieHistoryControllerLive = HttpApiBuilder.group(api, "calorieHistory", (handlers) =>
  handlers.handle("index", ({ query }) => CalorieHistory.index(query))
)
