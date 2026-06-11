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
      className={`rounded-xl px-4 py-3 ${selected ? 'border border-flame bg-surface' : 'bg-surface'}`}>
      <View className="gap-1">
        <Text className="font-medium text-ink">{label}</Text>
        {description ? <Text className="text-xs text-ink-soft">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
