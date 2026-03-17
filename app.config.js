export default {
  expo: {
    name: 'Sorteo Promocional',
    slug: 'sorteo-promocional',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    splash: { backgroundColor: '#2563eb' },
    ios: { supportsTablet: true, bundleIdentifier: 'com.sorteo.promocional' },
    android: {
      adaptiveIcon: { backgroundColor: '#2563eb' },
      package: 'com.sorteo.promocional',
    },
    plugins: ['expo-sqlite'],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000',
    },
  },
};
