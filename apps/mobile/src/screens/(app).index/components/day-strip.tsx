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
                isFuture ? 'text-ink-faint' : 'text-ink-soft'
              }`}>
              {WEEKDAY_INITIALS[i]}
            </Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-[9999px] ${
                isSelected
                  ? 'bg-flame'
                  : isSameLocalDay(d, today) && !isFuture
                    ? 'border border-flame'
                    : isFuture
                      ? ''
                      : 'border border-line'
              }`}>
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-white' : isFuture ? 'text-ink-faint' : 'text-ink'
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
