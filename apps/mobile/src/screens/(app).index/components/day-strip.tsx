import { Pressable, Text, View } from 'react-native';

import { diffInLocalDays, displayLocale, formatLocalDate, isSameLocalDay, weekDays } from '@/lib/date';

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
      {days.map((d) => {
        const isFuture = diffInLocalDays(d, today) > 0;
        const isSelected = isSameLocalDay(d, selectedDay);
        const isToday = isSameLocalDay(d, today);
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
              {d.toLocaleDateString(displayLocale(), { weekday: 'narrow' })}
            </Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-[9999px] ${
                isSelected ? 'bg-flame' : ''
              }`}>
              <Text
                className={`text-sm ${
                  isSelected
                    ? 'font-semibold text-white'
                    : isToday && !isFuture
                      ? 'font-semibold text-flame'
                      : isFuture
                        ? 'text-ink-faint'
                        : 'text-ink'
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
