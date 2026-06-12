import { t } from '@lingui/core/macro';
import { Modal, Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';

import { Palette } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

/**
 * A single-select bottom sheet for Profile's single-tap fields (Sex, Activity) — the INLINE-COMMIT
 * pattern (the established mobile idiom, kept from the @expo/ui spike): tapping an option commits
 * immediately and closes, no Save ceremony. Safe because same-day edits upsert the same
 * effective-tomorrow snapshot (ADR 0002), so repeat taps collapse into one row.
 */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { value: T; label: string; description?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: Palette.backdrop }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t`Close`} />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5">
          <Text className="text-lg font-semibold text-ink">{title}</Text>
          <View className="mt-4 gap-2">
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  haptics.selection();
                  onSelect(option.value);
                }}
                accessibilityState={{ selected: selected === option.value }}
                className={`flex-row items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  selected === option.value ? 'border-flame bg-surface' : 'border-line'
                }`}>
                <View className="min-w-0 gap-1">
                  <Text className="text-sm font-medium text-ink">{option.label}</Text>
                  {option.description ? (
                    <Text className="text-[10px] text-ink-soft">{option.description}</Text>
                  ) : null}
                </View>
                {selected === option.value ? (
                  <Text className="text-base font-semibold text-flame">✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
