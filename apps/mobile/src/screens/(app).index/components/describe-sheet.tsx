import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Palette } from '@/constants/theme';

import { getClient, run } from '@/client/api-client';

/**
 * The Describe door (ADR 0019) — log a Meal by text alone: `POST /meals { userText }`, the same
 * synchronous create+spinner the photo path has. The description rides the first Estimate row, so the
 * Improve sheet later prefills it. Uses the Modal shell from the SavedMealsSheet/OptionSheet pattern.
 *
 * capturedAt: ISO string when logging onto a past Day; undefined ⇒ server uses "now".
 */
export function DescribeSheet({
  visible,
  onClose,
  capturedAt,
}: {
  visible: boolean;
  onClose: () => void;
  capturedAt?: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const create = useMutation({
    mutationFn: async (userText: string) =>
      run(
        (await getClient()).meals.create({
          payload: { userText, ...(capturedAt ? { capturedAt } : {}) },
        })
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meals'] });
      setText('');
      onClose();
    },
  });

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !create.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: Palette.backdrop }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5 gap-3">
          <Text className="text-lg font-semibold text-ink">Describe your meal</Text>
          <Text className="text-sm text-ink-soft">
            What did you eat? Portions help — “two falafel sandwiches, small fries”.
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder="Chicken shawarma wrap with garlic sauce…"
            placeholderTextColor={Palette.inkFaint}
            className="rounded-xl bg-surface"
            style={{
              minHeight: 96,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              color: Palette.ink,
              textAlignVertical: 'top',
            }}
          />

          <Pressable
            onPress={() => create.mutate(trimmed)}
            disabled={!canSubmit}
            className={`h-12 items-center justify-center rounded-[9999px] bg-flame${canSubmit ? '' : ' opacity-60'}`}>
            {create.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-[17px] font-semibold text-white">Log meal</Text>
            )}
          </Pressable>

          {create.isError ? (
            <Text className="text-xs text-red">{describeErrorMessage(create.error)}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * An OLD self-hosted backend (pre-ADR-0019) rejects the photo-less payload with a decode-level 400 —
 * the app attempts and explains rather than probing capabilities (the contract drift is expected,
 * ADR 0018). Anything else is the usual transient-failure copy.
 */
function describeErrorMessage(error: unknown): string {
  const tag = (error as { _tag?: unknown } | null)?._tag;
  if (tag === 'HttpApiDecodeError' || tag === 'BadRequest') {
    return "Your Sufra server doesn't support describing meals yet. Update your deployment to use this.";
  }
  return "Couldn't save that meal. Try again in a moment.";
}
