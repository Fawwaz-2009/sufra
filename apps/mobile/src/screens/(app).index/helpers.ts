import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { MealListItemView } from '@sufra-web/worker/views/meal.ts';

export interface DaySummary {
  readonly consumed: number;
  readonly remaining: number;
  readonly target: number;
  readonly ratio: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly macros: {
    readonly proteinG: number;
    readonly carbsG: number;
    readonly fatG: number;
  };
}

export function buildSummary(
  meals: readonly MealListItemView[],
  profile: Parameters<typeof deriveProfile>[0]
): DaySummary {
  const derived = deriveProfile(profile);
  const totals = meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + (meal.totals?.kcal ?? 0),
      proteinG: acc.proteinG + (meal.totals?.proteinG ?? 0),
      carbsG: acc.carbsG + (meal.totals?.carbsG ?? 0),
      fatG: acc.fatG + (meal.totals?.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  const consumed = Math.round(totals.kcal);
  return {
    consumed,
    remaining: Math.round(derived.targetKcal - consumed),
    target: derived.targetKcal,
    ratio: derived.targetKcal > 0 ? consumed / derived.targetKcal : 0,
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    macros: derived.macros,
  };
}
