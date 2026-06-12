import { I18nManager, Text, View } from "react-native"
import { Pressable } from "@/components/pressable"
import { t } from "@lingui/core/macro"

import { DisplayText } from "@/components/display-text"

export function DayHeader({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  canGoNext: boolean
}) {
  return (
    <View className="flex-row items-center justify-between">
      <DisplayText className="text-ink text-2xl">{label}</DisplayText>
      <View className="flex-row items-center">
        <Pressable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel={t`Previous week`}
          className="h-10 w-10 items-center justify-center"
        >
          <Text className="text-ink-soft text-2xl">
            {I18nManager.isRTL ? "›" : "‹"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityLabel={t`Next week`}
          className="h-10 w-10 items-center justify-center"
        >
          <Text
            className={`text-2xl ${canGoNext ? "text-ink-soft" : "text-ink-faint"}`}
          >
            {I18nManager.isRTL ? "‹" : "›"}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
