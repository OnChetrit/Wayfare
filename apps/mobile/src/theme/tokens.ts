import { Appearance } from 'react-native';

export const darkColors = {
  background: '#090f0b',
  surface: '#17211b',
  surfaceMuted: '#1b2820',
  border: '#2d3d33',
  borderStrong: '#3b604c',
  text: '#edf5ef',
  textMuted: '#a9b8ae',
  accent: '#1f7658',
  accentText: '#ffffff',
  danger: '#f0a294',
  dangerSurface: '#422521',
  dangerBorder: '#75453e',
  success: '#4ab58b',
  locked: '#f4b35e',
  lockedSurface: '#352716',
  lockedBorder: '#80591f',
} as const;

export const lightColors = {
  background: '#f8f9f5',
  surface: '#ffffff',
  surfaceMuted: '#fbfcfa',
  border: '#e7ebe5',
  borderStrong: '#cfe5da',
  text: '#18211d',
  textMuted: '#78817c',
  accent: '#17795d',
  accentText: '#ffffff',
  danger: '#9a4e3c',
  dangerSurface: '#fff0eb',
  dangerBorder: '#f0d4cd',
  success: '#17795d',
  locked: '#8a4b08',
  lockedSurface: '#fff4e5',
  lockedBorder: '#e8b66a',
} as const;

export type ThemeName = 'light' | 'dark';
export type ThemeColors = { [Key in keyof typeof darkColors]: string };

export function themeColors(theme: ThemeName): ThemeColors {
  return theme === 'light' ? lightColors : darkColors;
}

/**
 * Legacy token access for components that calculate styles during render. New
 * components should prefer `useTheme` so changes to account appearance rerender
 * their styles immediately.
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get(_target, property: keyof ThemeColors) {
    return themeColors(Appearance.getColorScheme() === 'light' ? 'light' : 'dark')[property];
  },
});

export const radius = {
  card: 20,
  control: 14,
  pill: 999,
} as const;

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
