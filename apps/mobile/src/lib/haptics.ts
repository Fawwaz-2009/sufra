import * as Haptics from 'expo-haptics';

/**
 * Semantic haptics — named by the MOMENT, not the waveform, so call sites read as product
 * decisions and the vocabulary stays small: a meal/weight landing is `success`, a failed save is
 * `warning`, the destructive button of a confirm is `destructive`, a selector commit is
 * `selection`. Anything outside these four is deliberately silent (haptics on every tap is noise).
 * Fire-and-forget: never awaited, never throws (a device without a haptic engine just no-ops).
 */
export const haptics = {
  /** Something the Member asked for has landed — a Meal logged, a Weight logged, an Estimate refined. */
  success: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** A save failed and the UI is about to say so. */
  warning: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  /** The destructive button of a confirm dialog — deletion is about to run. */
  destructive: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  /** A selector committed — an option sheet row, a choice chip, a unit toggle, a slider detent. */
  selection: () => {
    void Haptics.selectionAsync().catch(() => {});
  },
};
