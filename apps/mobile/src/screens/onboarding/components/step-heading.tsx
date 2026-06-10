import { Text, View } from 'react-native';

export function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-6 gap-1">
      <Text className="text-2xl font-semibold text-black">{title}</Text>
      {subtitle ? <Text className="text-sm text-zinc-500">{subtitle}</Text> : null}
    </View>
  );
}
