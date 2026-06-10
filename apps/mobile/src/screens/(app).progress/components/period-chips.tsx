/**
 * PeriodChips — generic period-selector chip row used by the Weight and Calorie cards.
 * Ports apps/web/src/routes/progress/-components/period-chips.tsx onto RN primitives.
 */

import { Pressable, Text, View } from 'react-native';

interface PeriodChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}

export function PeriodChips<T extends string>({ options, value, onChange }: PeriodChipsProps<T>) {
  return (
    <View className="flex-row gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={`flex-1 items-center rounded-xl border py-2 ${active ? 'border-zinc-500' : 'border-zinc-200'}`}>
            <Text
              className={`text-xs font-medium ${active ? 'text-black' : 'text-zinc-500'}`}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
