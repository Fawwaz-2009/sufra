// The Warm Table palette (design.md) for color PROPS — SafeAreaView style, SVG props,
// placeholderTextColor, ActivityIndicator, the native tab bar. Product UI classes come from the
// SAME hex values in global.css @theme; change both together. Light is pinned (design.md).
export const Palette = {
  cream: '#F6E8D5',
  card: '#FFFBF2',
  sand: '#F0E2C9',
  sand2: '#E6D3B3',
  line: '#E3D2B6',
  ink: '#3A2A1B',
  inkSoft: '#8A7560',
  inkFaint: '#C2B197',
  flame: '#C75320',
  flameDeep: '#9E3F16',
  amber: '#EC8F3A',
  teal: '#539EA6',
  tealDeep: '#3D7B82',
  red: '#BE3B2B',
  white: '#FFFFFF',
  /** The mark's flame gradient, for SVG LinearGradient stops only. */
  gradientStart: '#D65B26',
  gradientEnd: '#EC8F3A',
  /** Modal backdrop — warm dim, not black. */
  backdrop: 'rgba(58, 42, 27, 0.45)',
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
