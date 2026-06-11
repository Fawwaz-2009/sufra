import type { ComponentProps } from 'react';
import { Text } from 'react-native';

/**
 * Display type — system face, weight 800, tight tracking (Daylight, design.md): screen titles
 * and hero numerals. Native-heavy like the reference class (Flighty/Structured); no custom font.
 * Size/color still come from className.
 */
export function DisplayText({ style, ...props }: ComponentProps<typeof Text>) {
  return <Text {...props} style={[{ fontWeight: '800', letterSpacing: -0.4 }, style]} />;
}
