import type { ReactNode } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// The css-wrapped Pressable (the babel import-rewrite) made animatable. createAnimatedComponent
// passes className through untouched, so NativeWind keeps resolving it on the inner element.
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

const PRESS_IN = { duration: 110, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 180, easing: Easing.out(Easing.quad) };

/**
 * The app's Pressable — a drop-in for React Native's with press feedback: a scale-down on touch
 * (~0.97, fast in / slightly slower out), so every button reads as a physical object instead of a
 * flat rectangle. Adopt by swapping the import; props and children are unchanged.
 *
 * The one narrowing: `style` takes plain styles only, not the `({ pressed }) => …` function form —
 * the pressed state is what this component owns. The scale transform is direction-neutral, so RTL
 * needs no handling here.
 */
export function Pressable({
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, pressed]}
      onPressIn={(e: GestureResponderEvent) => {
        scale.set(withTiming(0.97, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.set(withTiming(1, PRESS_OUT));
        onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}
