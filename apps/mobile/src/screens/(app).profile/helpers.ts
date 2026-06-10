import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getClient, run } from '@/client/api-client';
import { meKey, meQueryOptions } from '@/client/me';
import { tomorrowLocalDate } from '@/lib/date';
import type {
  ActivityLevel,
  HeightUnit,
  Sex,
  WeightUnit,
} from '@sufra-web/worker/models/profile-snapshot.ts';

// A single field-edit on the Profile. A Profile "edit" is an APPEND of a complete immutable snapshot
// effective tomorrow (ADR 0001/0002/0011) — never `weightKg`, which flows only through the Log Weight
// flow (ADR 0007).
export type ProfileEdit = Partial<{
  sex: Sex;
  birthday: string;
  heightCm: number;
  displayHeightUnit: HeightUnit;
  displayWeightUnit: WeightUnit;
  activityLevel: ActivityLevel;
  goalWeightKg: number;
  weeklyRateKg: number;
}>;

// Shared mutation used by every Profile sheet. Merges the changed field over the latest snapshot
// (read from the cached `/me`) into a COMPLETE snapshot effective tomorrow, POSTs it, and invalidates
// `/me`. The web's hook returns a boolean and toasts; native sheets read `isError` off the mutation
// and close on success via `mutateAsync`.
export function useProfilePatch() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQueryOptions());

  return useMutation({
    mutationFn: async (patch: ProfileEdit) => {
      const latest = me?.profiles[0];
      if (!latest) throw new Error("Couldn't save. Try again.");
      return run(
        (await getClient()).profileSnapshots.create({
          payload: {
            sex: latest.sex,
            birthday: latest.birthday,
            heightCm: latest.heightCm,
            displayHeightUnit: latest.displayHeightUnit,
            weightKg: latest.weightKg,
            displayWeightUnit: latest.displayWeightUnit,
            activityLevel: latest.activityLevel,
            goalWeightKg: latest.goalWeightKg,
            weeklyRateKg: latest.weeklyRateKg,
            ...patch,
            effectiveFrom: tomorrowLocalDate(),
          },
        })
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey }),
  });
}

// Display labels for activity-level enum values. Used by both the About-you row (read-only display)
// and the Activity sheet (chip labels).
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Little or no exercise',
  light: 'Exercise 1–3 days/week',
  moderate: 'Exercise 3–5 days/week',
  active: 'Exercise 6–7 days/week',
};
