import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = 1;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  // The entering keyframe's withCallback is the normal dismissal, but a cold-start race can skip
  // the entering animation entirely — leaving the opaque overlay over live UI forever. The timeout
  // guarantees dismissal either way.
  useEffect(() => {
    const fallback = setTimeout(() => setVisible(false), DURATION + 1400);
    return () => clearTimeout(fallback);
  }, []);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      pointerEvents="none"
      style={styles.backgroundSolidColor}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    // Matches the native splash background (app.json expo-splash-screen plugin) so the
    // native-splash → overlay → app fade reads as one continuous dismissal.
    backgroundColor: '#F6E8D5',
    zIndex: 1000,
  },
});
