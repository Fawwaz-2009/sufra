import { Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';
import { haptics } from '@/lib/haptics';

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
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityState={{ selected }}
      className={`rounded-xl px-4 py-3 ${selected ? 'border border-flame bg-surface' : 'bg-surface'}`}>
      <View className="gap-1">
        <Text className="font-medium text-ink">{label}</Text>
        {description ? <Text className="text-xs text-ink-soft">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
