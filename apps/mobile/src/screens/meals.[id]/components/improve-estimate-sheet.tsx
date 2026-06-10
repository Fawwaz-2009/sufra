import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

import { getClient, run } from '@/client/api-client';
import type { Analysis } from '@sufra-web/worker/models/estimate.ts';

/**
 * The Refinement sheet — free-text context that re-runs the AI against the stored photo (ADR 0017).
 * POSTs to `estimates.create` with `userText`; always appends, never replaces.
 */
export function ImproveEstimateSheet({
  visible,
  mealId,
  clarifications,
  lastRefinementText,
  onRefined,
  onClose,
}: {
  visible: boolean;
  mealId: string;
  clarifications: Analysis['clarifications'];
  lastRefinementText: string | null;
  onRefined: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(lastRefinementText ?? '');

  // Re-sync when the sheet opens so it prefills with the freshest Refinement text.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setText(lastRefinementText ?? '');
  }

  const mutation = useMutation({
    mutationKey: ['meal', mealId],
    mutationFn: async (userText: string) =>
      run(
        (await getClient()).estimates.create({ params: { id: mealId }, payload: { userText } })
      ),
    onSuccess: () => {
      onRefined();
    },
  });

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !mutation.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5">
          <Text className="text-lg font-semibold text-black">Improve this estimate</Text>

          {clarifications.length > 0 ? (
            <View className="mt-4 gap-2">
              <Text className="text-xs font-bold uppercase text-zinc-500">
                {"The AI wasn't sure about"}
              </Text>
              {clarifications.map((q) => (
                <Text key={q.id} className="text-sm text-black">
                  · {q.question}
                </Text>
              ))}
            </View>
          ) : null}

          <Text className="mt-4 text-xs font-bold uppercase text-zinc-500">
            Tell the AI what it missed
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="e.g. 2 scoops mixed with water"
            placeholderTextColor="#71717a"
            multiline
            numberOfLines={4}
            editable={!mutation.isPending}
            style={{
              marginTop: 8,
              borderWidth: 1,
              borderColor: '#e4e4e7',
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: '#000000',
              minHeight: 96,
              textAlignVertical: 'top',
            }}
          />

          {mutation.isError ? (
            <Text className="mt-2 text-sm text-red-600">{"Couldn't refine. Try again."}</Text>
          ) : null}

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={onClose}
              disabled={mutation.isPending}
              className="h-12 flex-1 items-center justify-center rounded-[9999px] border border-zinc-300">
              <Text className="text-base font-medium text-zinc-700">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => mutation.mutate(trimmed)}
              disabled={!canSubmit}
              className={`h-12 flex-1 items-center justify-center rounded-[9999px] bg-emerald-800${!canSubmit ? ' opacity-50' : ''}`}>
              {mutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">Refine with AI</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
