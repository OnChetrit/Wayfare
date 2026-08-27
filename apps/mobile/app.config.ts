import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wayfare',
  slug: 'wayfare',
  scheme: 'wayfare',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.onchetrit.wayfare',
    supportsTablet: false,
    infoPlist: {
      UIViewControllerBasedStatusBarAppearance: true,
    },
  },
  android: {
    package: 'com.onchetrit.wayfare',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    'expo-splash-screen',
    'react-native-quick-crypto',
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ?? '',
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: '6dba87c1-0604-49eb-9305-fff3934e1b99',
    },
  },
});
