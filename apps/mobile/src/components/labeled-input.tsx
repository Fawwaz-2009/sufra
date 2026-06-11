import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * The wizard's labeled numeric field — the native stand-in for the web's Label + Input pair.
 * Deliberately NO `flex-1` here: in a COLUMN container flexBasis 0 collapses the field to zero
 * height (invisible — the Height-sheet bug). Row contexts wrap it in `<View className="flex-1">`.
 */
export function LabeledInput({ label, ...inputProps }: { label: string } & TextInputProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <TextInput
        className="rounded-2xl bg-sand px-4 py-4 text-[17px] text-ink"
        placeholderTextColor={Palette.inkFaint}
        style={{ borderColor: Palette.line, color: Palette.ink }}
        {...inputProps}
      />
    </View>
  );
}
