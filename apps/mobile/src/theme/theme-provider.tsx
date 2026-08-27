import * as React from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { accountPreferencesFromMetadata } from '@/lib/account-preferences';

import { themeColors, type ThemeColors, type ThemeName } from './tokens';

type ThemeContextValue = {
  colors: ThemeColors;
  preference: 'system' | ThemeName;
  theme: ThemeName;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function resolvedTheme(
  preference: 'system' | ThemeName,
  deviceTheme: ReturnType<typeof useColorScheme>,
): ThemeName {
  if (preference !== 'system') return preference;
  return deviceTheme === 'light' ? 'light' : 'dark';
}

export function WayfareThemeProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const deviceTheme = useColorScheme();
  const preference = accountPreferencesFromMetadata(session?.user.user_metadata).theme;
  const theme = resolvedTheme(preference, deviceTheme);

  React.useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const value = React.useMemo(
    () => ({ colors: themeColors(theme), preference, theme }),
    [preference, theme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const context = React.use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside WayfareThemeProvider.');
  return context;
}
