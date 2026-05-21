import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// 10 dishes from Nutrition5K (Google Research, 2021): each was physically
// weighed and per-ingredient mass was multiplied by USDA nutrients to get the
// totals + breakdown. Source of truth — no hand-curation.
//
// Each dish carries a pre-baked `userContext` string that describes the actual
// portions on the plate. The eval's "with-hints" variant injects this into the
// user message to test whether extra portion info improves the model's estimate
// (PRD §6.4 — the clarification flow modeled as an optional input, not a
// literal two-pass loop).

const here = dirname(fileURLToPath(import.meta.url))

function imgDataUrl(filename: string): string {
  const buf = readFileSync(join(here, "fixtures/images", filename))
  return `data:image/jpeg;base64,${buf.toString("base64")}`
}

export type Ingredient = {
  name: string
  grams: number
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type Dish = {
  dishKey: string
  imageUrl: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  ingredients: Ingredient[]
  /** Pre-baked "user-confirmed portions" hint, for the with-hints variant. */
  userContext: string
}

function ctx(ingredients: Ingredient[]): string {
  const list = ingredients.map((i) => `${i.name} ${Math.round(i.grams)}g`).join(", ")
  return `Heads-up from the user: the portions on the plate are ${list}.`
}

function dish(input: Omit<Dish, "imageUrl" | "userContext"> & { image: string }): Dish {
  const { image, ...rest } = input
  return { ...rest, imageUrl: imgDataUrl(image), userContext: ctx(rest.ingredients) }
}

export const DISHES: Dish[] = [
  dish({
    dishKey: "dish_1558459115",
    image: "dish_1558459115.jpg",
    kcal: 271.5,
    proteinG: 6.62,
    carbsG: 43.46,
    fatG: 10.49,
    ingredients: [
      { name: "almonds", grams: 20, kcal: 115.62, fatG: 9.9, carbsG: 4.54, proteinG: 4.48 },
      { name: "apple", grams: 143, kcal: 74.36, fatG: 0.286, carbsG: 20.02, proteinG: 0.429 },
      { name: "white rice", grams: 32, kcal: 41.6, fatG: 0.096, carbsG: 8.96, proteinG: 0.864 },
      { name: "cherry tomatoes", grams: 61, kcal: 10.98, fatG: 0.122, carbsG: 2.379, proteinG: 0.549 },
      { name: "grapes", grams: 42, kcal: 28.98, fatG: 0.084, carbsG: 7.56, proteinG: 0.294 },
    ],
  }),
  dish({
    dishKey: "dish_1558380557",
    image: "dish_1558380557.jpg",
    kcal: 699.3, proteinG: 32.73, carbsG: 24.96, fatG: 54.44,
    ingredients: [
      { name: "grapes", grams: 52, kcal: 35.88, fatG: 0.104, carbsG: 9.36, proteinG: 0.364 },
      { name: "almonds", grams: 48, kcal: 277.49, fatG: 23.76, carbsG: 10.896, proteinG: 10.752 },
      { name: "sausage", grams: 112, kcal: 385.95, fatG: 30.576, carbsG: 4.704, proteinG: 21.616 },
    ],
  }),
  dish({
    dishKey: "dish_1558724959",
    image: "dish_1558724959.jpg",
    kcal: 581.4, proteinG: 21.30, carbsG: 57.00, fatG: 36.47,
    ingredients: [
      { name: "brussels sprouts", grams: 118, kcal: 50.74, fatG: 0.354, carbsG: 10.62, proteinG: 4.012 },
      { name: "carrot", grams: 75, kcal: 30.75, fatG: 0.15, carbsG: 7.5, proteinG: 0.675 },
      { name: "almonds", grams: 72, kcal: 416.23, fatG: 35.64, carbsG: 16.344, proteinG: 16.128 },
      { name: "apple", grams: 161, kcal: 83.72, fatG: 0.322, carbsG: 22.54, proteinG: 0.483 },
    ],
  }),
  dish({
    dishKey: "dish_1561739238",
    image: "dish_1561739238.jpg",
    kcal: 274.2, proteinG: 9.46, carbsG: 37.56, fatG: 9.79,
    ingredients: [
      { name: "egg whites", grams: 71, kcal: 36.92, fatG: 0.142, carbsG: 0.497, proteinG: 7.1 },
      { name: "hash browns", grams: 43, kcal: 140.18, fatG: 9.46, carbsG: 13.76, proteinG: 1.118 },
      { name: "berries", grams: 61, kcal: 34.77, fatG: 0.183, carbsG: 8.54, proteinG: 0.427 },
      { name: "sweet potato", grams: 82, kcal: 62.32, fatG: 0, carbsG: 14.76, proteinG: 0.82 },
    ],
  }),
  dish({
    dishKey: "dish_1564761488",
    image: "dish_1564761488.jpg",
    kcal: 328.0, proteinG: 21.74, carbsG: 40.56, fatG: 8.36,
    ingredients: [
      { name: "turkey bacon", grams: 21, kcal: 79.74, fatG: 5.901, carbsG: 0.651, proteinG: 6.111 },
      { name: "egg whites", grams: 105, kcal: 54.6, fatG: 0.21, carbsG: 0.735, proteinG: 10.5 },
      { name: "fried rice", grams: 97, kcal: 152.97, fatG: 2.134, carbsG: 29.003, proteinG: 4.559 },
      { name: "honeydew melons", grams: 113, kcal: 40.68, fatG: 0.113, carbsG: 10.17, proteinG: 0.565 },
    ],
  }),
  dish({
    dishKey: "dish_1558724031",
    image: "dish_1558724031.jpg",
    kcal: 358.7, proteinG: 14.07, carbsG: 25.79, fatG: 25.80,
    ingredients: [
      { name: "cherry tomatoes", grams: 107, kcal: 19.26, fatG: 0.214, carbsG: 4.173, proteinG: 0.963 },
      { name: "cantaloupe", grams: 93, kcal: 31.62, fatG: 0.186, carbsG: 7.44, proteinG: 0.744 },
      { name: "almonds", grams: 51, kcal: 294.83, fatG: 25.245, carbsG: 11.577, proteinG: 11.424 },
      { name: "cauliflower", grams: 52, kcal: 13, fatG: 0.156, carbsG: 2.6, proteinG: 0.936 },
    ],
  }),
  dish({
    dishKey: "dish_1559838402",
    image: "dish_1559838402.jpg",
    kcal: 222.8, proteinG: 5.25, carbsG: 43.15, fatG: 3.80,
    ingredients: [
      { name: "bacon", grams: 8, kcal: 43.28, fatG: 3.36, carbsG: 0.112, proteinG: 2.96 },
      { name: "sweet potato", grams: 59.5, kcal: 45.22, fatG: 0, carbsG: 10.71, proteinG: 0.595 },
      { name: "yam", grams: 59.5, kcal: 73.84, fatG: 0.119, carbsG: 17.493, proteinG: 0.952 },
      { name: "berries", grams: 106, kcal: 60.42, fatG: 0.318, carbsG: 14.84, proteinG: 0.742 },
    ],
  }),
  dish({
    dishKey: "dish_1562691032",
    image: "dish_1562691032.jpg",
    kcal: 419.7, proteinG: 17.95, carbsG: 39.06, fatG: 22.04,
    ingredients: [
      { name: "berries", grams: 85, kcal: 48.45, fatG: 0.255, carbsG: 11.9, proteinG: 0.595 },
      { name: "olive oil", grams: 0.9, kcal: 7.98, fatG: 0.902, carbsG: 0, proteinG: 0 },
      { name: "pineapple", grams: 80, kcal: 40, fatG: 0.08, carbsG: 10.4, proteinG: 0.4 },
      { name: "scrambled eggs", grams: 147, kcal: 217.56, fatG: 16.17, carbsG: 2.352, proteinG: 14.7 },
      { name: "roasted potatoes", grams: 66, kcal: 93.06, fatG: 4.488, carbsG: 11.88, proteinG: 1.386 },
      { name: "broccoli", grams: 36.1, kcal: 12.63, fatG: 0.144, carbsG: 2.527, proteinG: 0.866 },
    ],
  }),
  dish({
    dishKey: "dish_1563207364",
    image: "dish_1563207364.jpg",
    kcal: 309.3, proteinG: 15.01, carbsG: 30.66, fatG: 13.77,
    ingredients: [
      { name: "scrambled eggs", grams: 68, kcal: 100.64, fatG: 7.48, carbsG: 1.088, proteinG: 6.8 },
      { name: "yam", grams: 50, kcal: 62.05, fatG: 0.1, carbsG: 14.7, proteinG: 0.8 },
      { name: "grapes", grams: 30, kcal: 20.7, fatG: 0.06, carbsG: 5.4, proteinG: 0.21 },
      { name: "egg whites", grams: 67, kcal: 34.84, fatG: 0.134, carbsG: 0.469, proteinG: 6.7 },
      { name: "olive oil", grams: 6, kcal: 53.04, fatG: 6, carbsG: 0, proteinG: 0 },
      { name: "sweet potato", grams: 50, kcal: 38, fatG: 0, carbsG: 9, proteinG: 0.5 },
    ],
  }),
  dish({
    dishKey: "dish_1563468327",
    image: "dish_1563468327.jpg",
    kcal: 351.9, proteinG: 12.10, carbsG: 57.50, fatG: 9.77,
    ingredients: [
      { name: "yam", grams: 46.23, kcal: 57.37, fatG: 0.092, carbsG: 13.591, proteinG: 0.74 },
      { name: "sweet potato", grams: 46.23, kcal: 35.13, fatG: 0, carbsG: 8.321, proteinG: 0.462 },
      { name: "cottage cheese", grams: 83, kcal: 81.34, fatG: 3.569, carbsG: 2.822, proteinG: 9.13 },
      { name: "pineapple", grams: 107, kcal: 53.5, fatG: 0.107, carbsG: 13.91, proteinG: 0.535 },
      { name: "watermelon", grams: 132, kcal: 39.6, fatG: 0.264, carbsG: 10.032, proteinG: 0.792 },
      { name: "olive oil", grams: 5.55, kcal: 49.04, fatG: 5.547, carbsG: 0, proteinG: 0 },
      { name: "berries", grams: 63, kcal: 35.91, fatG: 0.189, carbsG: 8.82, proteinG: 0.441 },
    ],
  }),
]
