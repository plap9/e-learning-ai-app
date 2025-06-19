// Theme constants based on "Soft Midnight Aurora" color palette
export const Colors = {
  // Primary Colors
  softAuroraPurple: '#A855F7',
  lightAuroraGlow: '#DDD6FE',
  mediumAuroraDepth: '#8B5CF6',

  // Secondary Colors
  gentleMidnightBlue: '#3B82F6',
  starlightMistBg: '#EFF6FF',
  cosmicSoftContrast: '#2563EB',

  // Accent Colors
  pastelMagenta: '#C084FC',
  whisperPinkBg: '#FAF5FF',
  gentleGlowActive: '#A78BFA',
  greenAccent: '#34D399',

  // Neutral Colors
  white: '#FFFFFF',
  lightBg: '#F8FAFC',
  borderColor: '#E2E8F0',
  inactiveGray: '#94A3B8',
  darkText: '#1E293B',

  // Background
  backgroundMain: '#E0E7FF',
} as const;

export const Gradients = {
  gradientFlow: ['#A855F7', '#60A5FA', '#34D399'],
  progressBarFill: ['#A855F7', '#60A5FA'],
  splashBgGradient: ['#FAF5FF', '#EFF6FF'],
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  xxxxl: 40,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 30,
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  xxxxl: 28,
  xxxxxl: 32,
} as const;

export const FontWeights = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6.27,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10.32,
    elevation: 8,
  },
} as const;

export const Theme = {
  colors: Colors,
  gradients: Gradients,
  spacing: Spacing,
  borderRadius: BorderRadius,
  fontSizes: FontSizes,
  fontWeights: FontWeights,
  shadows: Shadows,
} as const;

export type ThemeType = typeof Theme; 