import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wayfare',
  slug: 'wayfare',
  icon: './assets/images/icon.png',
  scheme: 'wayfare',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/wayfare.icon',
    bundleIdentifier: 'com.onchetrit.wayfare',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: true,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#F8F9F5',
      backgroundImage: './assets/images/android-icon-background.png',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: 'com.onchetrit.wayfare',
    permissions: ['android.permission.SCHEDULE_EXACT_ALARM'],
  },
  plugins: [
    'expo-sharing',
    'expo-image',
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    'expo-splash-screen',
    [
      'expo-notifications',
      {
        defaultChannel: 'reminders',
      },
    ],
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
