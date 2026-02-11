// Design tokens shared between web and mobile

export const colors = {
  // Brand colors
  brand: {
    primary: '#22c55e', // Green
    primaryDark: '#16a34a',
    primaryLight: '#4ade80',
    secondary: '#0ea5e9', // Blue
    secondaryDark: '#0284c7',
    secondaryLight: '#38bdf8',
  },
  
  // Semantic colors
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Crypto asset colors
  crypto: {
    eth: '#627EEA',
    btc: '#F7931A',
    bnb: '#F3BA2F',
    matic: '#8247E5',
    avax: '#E84142',
    usdt: '#26A17B',
    usdc: '#2775CA',
  },
  
  // Status colors for withdrawals/deposits
  status: {
    pending: '#f59e0b',
    processing: '#3b82f6',
    success: '#22c55e',
    failed: '#ef4444',
    rejected: '#ef4444',
  },
  
  // Light theme
  light: {
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    backgroundTertiary: '#f1f5f9',
    foreground: '#0f172a',
    foregroundSecondary: '#475569',
    foregroundMuted: '#94a3b8',
    border: '#e2e8f0',
    borderFocus: '#22c55e',
  },
  
  // Dark theme
  dark: {
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',
    foreground: '#f8fafc',
    foregroundSecondary: '#cbd5e1',
    foregroundMuted: '#64748b',
    border: '#334155',
    borderFocus: '#22c55e',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// Animation durations
export const durations = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Breakpoints (for web)
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;
