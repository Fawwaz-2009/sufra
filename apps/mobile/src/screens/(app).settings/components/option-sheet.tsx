import { Modal, Pressable, Text, View } from 'react-native';

/**
 * A single-select bottom sheet for Settings' single-tap fields (Sex, Activity) — the INLINE-COMMIT
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
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="rounded-t-2xl bg-white px-6 pb-10 pt-5">
          <Text className="text-lg font-semibold text-black">{title}</Text>
          <View className="mt-4 gap-2">
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                accessibilityState={{ selected: selected === option.value }}
                className={`flex-row items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  selected === option.value ? 'border-black bg-zinc-100' : 'border-zinc-200'
                }`}>
                <View className="min-w-0 gap-1">
                  <Text className="text-sm font-medium text-black">{option.label}</Text>
                  {option.description ? (
                    <Text className="text-[10px] text-zinc-500">{option.description}</Text>
                  ) : null}
                </View>
                {selected === option.value ? (
                  <Text className="text-base font-semibold text-black">✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
