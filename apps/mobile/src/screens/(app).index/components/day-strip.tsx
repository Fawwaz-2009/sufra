import { Pressable, Text, View } from 'react-native';

import { diffInLocalDays, formatLocalDate, isSameLocalDay, weekDays } from '@/lib/date';

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DayStrip({
  weekStartDate,
  selectedDay,
  today,
  onSelect,
}: {
  weekStartDate: Date;
  selectedDay: Date;
  today: Date;
  onSelect: (d: Date) => void;
}) {
  const days = weekDays(weekStartDate);
  return (
    <View className="flex-row pb-2">
      {days.map((d, i) => {
        const isFuture = diffInLocalDays(d, today) > 0;
        const isSelected = isSameLocalDay(d, selectedDay);
        return (
          <Pressable
            key={formatLocalDate(d)}
            disabled={isFuture}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: isFuture }}
            className="flex-1 items-center gap-1 py-1">
            <Text
              className={`text-[10px] font-medium uppercase ${
                isFuture ? 'text-zinc-300' : 'text-zinc-500'
              }`}>
              {WEEKDAY_INITIALS[i]}
            </Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-[9999px] ${
                isSelected ? 'bg-black' : isFuture ? '' : 'border border-zinc-200'
              }`}>
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-white' : isFuture ? 'text-zinc-300' : 'text-black'
                }`}>
                {d.getDate()}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
