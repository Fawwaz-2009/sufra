import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { Palette } from '@/constants/theme';

import { getClient, run } from '@/client/api-client';
import { haptics } from '@/lib/haptics';
import { getLocale } from '@/lib/locale';

/**
 * The Describe door (ADR 0019) -- log a Meal by text alone: `POST /meals { userText }`, the same
 * synchronous create+spinner the photo path has. The description rides the first Estimate row, so the
 * Improve sheet later prefills it. Uses the Modal shell from the SavedMealsSheet/OptionSheet pattern.
 *
 * capturedAt: ISO string when logging onto a past Day; undefined => server uses "now".
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
          payload: { userText, locale: getLocale(), ...(capturedAt ? { capturedAt } : {}) },
        })
      ),
    onSuccess: () => {
      haptics.success();
      void queryClient.invalidateQueries({ queryKey: ['meals'] });
      setText('');
      onClose();
    },
    onError: () => haptics.warning(),
  });

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !create.isPending;

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
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5 gap-3">
          <Text className="text-lg font-semibold text-ink">
            <Trans>Describe your meal</Trans>
          </Text>
          <Text className="text-sm text-ink-soft">
            <Trans>What did you eat? Portions help</Trans>
            {' — “two falafel sandwiches, small fries”.'}
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder={t`Chicken shawarma wrap with garlic sauce…`}
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
              <Text className="text-[17px] font-semibold text-white">
                <Trans>Log meal</Trans>
              </Text>
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
 * An OLD self-hosted backend (pre-ADR-0019) rejects the photo-less payload with a decode-level 400 --
 * the app attempts and explains rather than probing capabilities (the contract drift is expected,
 * ADR 0018). Anything else is the usual transient-failure copy.
 */
function describeErrorMessage(error: unknown): string {
  const tag = (error as { _tag?: unknown } | null)?._tag;
  if (tag === 'HttpApiDecodeError' || tag === 'BadRequest') {
    return t`Your Sufra server doesn't support describing meals yet. Update your deployment to use this.`;
  }
  return t`Couldn't save that meal. Try again in a moment.`;
}
