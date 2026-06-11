import type { ComponentProps } from 'react';
import { Text } from 'react-native';

/**
 * The display face — Fraunces SemiBold (design.md). The ONLY way display type is set: screen
 * titles, the day-header label, hero numerals, the wordmark. Size/color still come from className;
 * the fontFamily rides the style prop because the NativeWind allowlist carries no font utilities.
 */
export function DisplayText({ style, ...props }: ComponentProps<typeof Text>) {
  return <Text {...props} style={[{ fontFamily: 'Fraunces_600SemiBold' }, style]} />;
}
