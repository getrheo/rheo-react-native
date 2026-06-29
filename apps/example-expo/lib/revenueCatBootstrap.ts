import { Platform } from 'react-native';

let didConfigure = false;

const getApiKey = (): string => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '';
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '';
  }
  return '';
};

/**
 * Configure RevenueCat and align the RC app user id with Rheo `identity.appUserId`
 * before the flow can present a paywall step. Safe to call when env keys are unset (no-op).
 *
 * Requires a dev build (`expo run:ios` / `expo run:android`); Expo Go cannot load these native modules.
 */
export const prepareRevenueCatForFlow = async (userId: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Purchases = require('react-native-purchases').default as typeof import('react-native-purchases').default;

  if (!didConfigure) {
    Purchases.configure({ apiKey });
    didConfigure = true;
  }
  const uid = userId.trim() || 'example-user';
  await Purchases.logIn(uid);
};
