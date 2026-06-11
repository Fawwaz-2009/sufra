import { Pressable, Text } from 'react-native';

export function ChipButton({
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
      className={`gap-1 rounded-xl border px-3 py-3 ${selected ? 'border-flame bg-flame' : 'border-line'}`}>
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-ink'}`}>{label}</Text>
      {description ? <Text className={`text-[10px] ${selected ? 'text-white opacity-60' : 'text-ink-soft'}`}>{description}</Text> : null}
    </Pressable>
  );
}
