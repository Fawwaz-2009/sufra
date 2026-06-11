import { Pressable, Text, View } from 'react-native';

export function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row self-start rounded-[9999px] bg-sand p-1">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          className={`rounded-[9999px] px-3 py-1 ${value === o.value ? 'bg-flame' : ''}`}>
          <Text
            className={`text-xs font-medium ${value === o.value ? 'text-white' : 'text-ink-soft'}`}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
