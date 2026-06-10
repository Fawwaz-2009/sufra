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
      className={`gap-1 rounded-xl border px-3 py-3 ${selected ? 'border-black bg-zinc-100' : 'border-zinc-200'}`}>
      <Text className="text-sm font-medium text-black">{label}</Text>
      {description ? <Text className="text-[10px] text-zinc-500">{description}</Text> : null}
    </Pressable>
  );
}
