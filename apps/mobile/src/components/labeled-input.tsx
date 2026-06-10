import { Text, TextInput, View, type TextInputProps } from 'react-native';

/** The wizard's labeled numeric field — the native stand-in for the web's Label + Input pair. */
export function LabeledInput({ label, ...inputProps }: { label: string } & TextInputProps) {
  return (
    <View className="flex-1 gap-2">
      <Text className="text-sm font-medium text-black">{label}</Text>
      <TextInput
        className="rounded-2xl bg-zinc-100 px-4 py-4 text-[17px] text-black"
        placeholderTextColor="#71717A"
        {...inputProps}
      />
    </View>
  );
}
