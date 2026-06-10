import { Pressable, Text, View } from 'react-native';

export function ChoiceChip({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      className={`rounded-xl border px-4 py-3 ${selected ? 'border-black bg-zinc-100' : 'border-zinc-200'}`}>
      <View className="gap-1">
        <Text className="font-medium text-black">{label}</Text>
        {description ? <Text className="text-xs text-zinc-500">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
