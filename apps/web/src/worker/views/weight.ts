import * as Schema from "effect/Schema"
import { Weight } from "../models/weight.ts"

/**
 * The Weight view — one measurement, plain JSON. `id` (for the chart's tap-a-dot delete), the value, and
 * `loggedAt` (the x-axis instant). `createdAt` is the audit stamp, not surfaced.
 */
export const WeightView = Schema.Struct({
  id: Schema.String,
  weightKg: Schema.Number,
  loggedAt: Schema.String
})
export type WeightView = typeof WeightView.Type
export type WeightViewEncoded = typeof WeightView.Encoded

/** Serialize a weight row → its view. */
export const toWeightView = (row: typeof Weight.select.Type): WeightView => ({
  id: row.id,
  weightKg: row.weightKg,
  loggedAt: row.loggedAt
})
