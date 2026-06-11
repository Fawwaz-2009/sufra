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
      className={`rounded-xl border px-4 py-3 ${selected ? 'border-flame bg-sand' : 'border-line'}`}>
      <View className="gap-1">
        <Text className="font-medium text-ink">{label}</Text>
        {description ? <Text className="text-xs text-ink-soft">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
