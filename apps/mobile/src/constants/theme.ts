// The Daylight palette (design.md) for color PROPS — SafeAreaView style, SVG props,
// placeholderTextColor, ActivityIndicator, the native tab bar. Product UI classes come from the
// SAME hex values in global.css @theme; change both together. Light is pinned (design.md).
export const Palette = {
  white: '#FFFFFF',
  surface: '#F5F4F2',
  track: '#EBE7E1',
  line: '#ECE9E4',
  ink: '#1A1816',
  inkSoft: '#75706A',
  inkFaint: '#B9B3AA',
  flame: '#E45527',
  flameDeep: '#C2431D',
  amber: '#D99A36',
  teal: '#45929A',
  tealDeep: '#45929A',
  red: '#C73A2A',
  /** The ring's ember gradient, for SVG LinearGradient stops only. */
  gradientStart: '#E45527',
  gradientEnd: '#F0883F',
  /** Modal backdrop. */
  backdrop: 'rgba(20, 16, 12, 0.5)',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
