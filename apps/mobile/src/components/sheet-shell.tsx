import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/pressable';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';

/**
 * Common chrome for every Profile field-edit sheet — the native stand-in for the web's shadcn
 * bottom sheet: an RN Modal sliding a card up from the bottom, the field-specific inputs, the
 * "starts tomorrow" affordance (ADR 0002), and the Cancel / Save buttons with their disabled /
 * saving states. Tap on the dimmed backdrop dismisses.
 */
export function SheetShell({
  visible,
  title,
  children,
  onClose,
  onSave,
  saving,
  disabled,
  error,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
  error?: string | null;
}) {
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
          <Text className="text-lg font-semibold text-ink">{title}</Text>
          <View className="mt-4 gap-4">{children}</View>
          <View className="mt-4 rounded-xl bg-surface px-3 py-2">
            <Text className="text-xs text-ink-soft">
              <Trans>Starts tomorrow at midnight (your local time).</Trans>
            </Text>
          </View>
          {error ? <Text className="mt-2 text-sm text-red">{error}</Text> : null}
          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={onClose}
              disabled={saving}
              className="h-12 flex-1 items-center justify-center rounded-[9999px]">
              <Text className="text-base font-medium text-ink-soft"><Trans>Cancel</Trans></Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={disabled || saving}
              className={`h-12 flex-1 items-center justify-center rounded-[9999px] bg-flame ${
                disabled || saving ? 'opacity-60' : ''
              }`}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white"><Trans>Save</Trans></Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Live preview of derived target + macros for the draft inputs. Renders alongside every sheet so
 * the Member can see the effect of their edit before committing.
 */
export function PreviewBox({
  inputs,
  previousTarget,
}: {
  inputs: Parameters<typeof deriveProfile>[0];
  previousTarget: number;
}) {
  const derived = deriveProfile(inputs);
  const changed = derived.targetKcal !== previousTarget;
  return (
    <View className="rounded-xl bg-surface p-3">
      <Text className="text-xs uppercase text-ink-soft"><Trans>Daily target</Trans></Text>
      <View className="mt-1 flex-row items-baseline gap-1">
        <DisplayText className="text-2xl text-ink">{derived.targetKcal}</DisplayText>
        <Text className="text-xs text-ink-soft"><Trans>kcal</Trans></Text>
        {changed ? <Text className="ml-2 text-xs text-ink-soft"><Trans>was {previousTarget}</Trans></Text> : null}
      </View>
      <Text className="mt-1 text-xs text-ink-soft">
        <Trans>P {derived.macros.proteinG}g · C {derived.macros.carbsG}g · F {derived.macros.fatG}g</Trans>
      </Text>
    </View>
  );
}
