import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from '@/components/pressable';

import { getClient, run } from '@/client/api-client';
import { haptics } from '@/lib/haptics';
import { getLocale } from '@/lib/locale';
import { Palette } from '@/constants/theme';
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
        (await getClient()).estimates.create({
          params: { id: mealId },
          payload: { userText, locale: getLocale() },
        })
      ),
    onSuccess: () => {
      haptics.success();
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
        style={{ backgroundColor: Palette.backdrop }}>
        {/* Dismiss the keyboard WITH the sheet — without this an Android backdrop tap closes the
            sheet and strands the keyboard over the screen behind it. */}
        <Pressable
          className="flex-1"
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          accessibilityLabel={t`Close`}
        />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5">
          <Text className="text-lg font-semibold text-ink">
            <Trans>Improve this estimate</Trans>
          </Text>

          {clarifications.length > 0 ? (
            <View className="mt-4 gap-2 rounded-xl bg-surface p-3">
              <Text className="text-xs font-bold uppercase text-ink-soft">
                <Trans>The AI wasn&apos;t sure about</Trans>
              </Text>
              {clarifications.map((q) => (
                <Text key={q.id} className="text-sm text-ink">
                  · {q.question}
                </Text>
              ))}
            </View>
          ) : null}

          <Text className="mt-4 text-xs font-bold uppercase text-ink-soft">
            <Trans>Tell the AI what it missed</Trans>
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t`e.g. 2 scoops mixed with water`}
            placeholderTextColor={Palette.inkFaint}
            multiline
            numberOfLines={4}
            editable={!mutation.isPending}
            style={{
              marginTop: 8,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: Palette.ink,
              minHeight: 96,
              textAlignVertical: 'top',
              backgroundColor: Palette.surface,
            }}
          />

          {mutation.isError ? (
            <Text className="mt-2 text-sm text-red">{t`Couldn't refine. Try again.`}</Text>
          ) : null}

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={onClose}
              disabled={mutation.isPending}
              className="h-12 flex-1 items-center justify-center">
              <Text className="text-base text-ink-soft">
                <Trans>Cancel</Trans>
              </Text>
            </Pressable>
            <Pressable
              onPress={() => mutation.mutate(trimmed)}
              disabled={!canSubmit}
              className={`h-12 flex-1 items-center justify-center rounded-[9999px] bg-flame${!canSubmit ? ' opacity-60' : ''}`}>
              {mutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  <Trans>Refine with AI</Trans>
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
