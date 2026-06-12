import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { getLocale } from '@/lib/locale';

/**
 * Display type — system face, weight 800, tight tracking (Daylight, design.md): screen titles
 * and hero numerals. Native-heavy like the reference class (Flighty/Structured); no custom font.
 * Size/color still come from className.
 *
 * letterSpacing -0.4 is skipped for Arabic: negative tracking breaks Arabic letter joins (ADR 0020).
 */
export function DisplayText({ style, ...props }: ComponentProps<typeof Text>) {
  const letterSpacing = getLocale() !== 'ar' ? -0.4 : undefined;
  return <Text {...props} style={[{ fontWeight: '800', letterSpacing }, style]} />;
}
