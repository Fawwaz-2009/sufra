import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';

import { getClient, run } from '@/client/api-client';
import { MealCard } from '@/components/meal-card';
import { savedMealsQueryOptions } from '@/screens/meals.[id]/queries';

/**
 * Native counterpart of the web SavedMealsSheet — pick a Saved Meal to clone onto the
 * current Day. Uses the Modal shell from the OptionSheet pattern.
 *
 * capturedAt: ISO string when cloning onto a past Day; undefined ⇒ server uses "now".
 */
export function SavedMealsSheet({
  visible,
  onClose,
  capturedAt,
}: {
  visible: boolean;
  onClose: () => void;
  capturedAt?: string;
}) {
  const queryClient = useQueryClient();

  const savedQuery = useQuery({ ...savedMealsQueryOptions(), enabled: visible });
  const meals = savedQuery.data ?? [];

  const clone = useMutation({
    mutationFn: async (sourceMealId: string) =>
      run(
        (await getClient()).clones.create({
          params: { id: sourceMealId },
          payload: { ...(capturedAt ? { capturedAt } : {}) },
        })
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meals'] });
      onClose();
    },
    onError: () => {
      Alert.alert("Couldn't add", "Couldn't add that meal. Try again.");
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: Palette.backdrop }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5">
          <Text className="text-lg font-semibold text-ink">Pick a saved meal</Text>

          {savedQuery.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator />
            </View>
          ) : meals.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Text className="text-sm font-medium text-ink">No saved meals yet</Text>
              <Text className="text-center text-sm text-ink-soft">
                Tap Save on any meal to save it for quick re-logging.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 400 }}
              className="mt-4"
              showsVerticalScrollIndicator={false}>
              <View className="gap-3 pb-2">
                {meals.map((m) => (
                  <MealCard
                    key={m.id}
                    meal={m}
                    onPress={() => {
                      if (!clone.isPending) clone.mutate(m.id);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
