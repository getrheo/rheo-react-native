import { Platform } from 'react-native';

/** Avoid calling `initSdk` twice (e.g. config screen + onboarding route both prepare). */
let appsFlyerSdkInitialized = false;

/**
 * Initializes AppsFlyer before `<Flow />` mounts so the SDK can emit
 * install / deep-link payloads that `@getrheo/react-native-expo` merges into decision
 * attributes (after channel resolve, when the workspace plan allows attribution,
 * and when AppsFlyer is enabled for the app in the dashboard — see resolve
 * `integrations.appsflyer.enabled`).
 *
 * No-op on web, when env is unset, or when the native module is unavailable.
 */
export const prepareAppsFlyerForFlow = async (customerUserId: string): Promise<void> => {
  if (Platform.OS === 'web') return;

  const devKey = process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY?.trim();
  if (!devKey) {
    console.warn(
      '[rheo-example] AppsFlyer: set EXPO_PUBLIC_APPSFLYER_DEV_KEY (and iOS App Store id) in .env to exercise MMP attribution — dev build only, not Expo Go.',
    );
    return;
  }

  const iosAppId = process.env.EXPO_PUBLIC_APPSFLYER_IOS_APP_ID?.trim() ?? '';
  if (Platform.OS === 'ios' && !iosAppId) {
    console.warn(
      '[rheo-example] AppsFlyer: EXPO_PUBLIC_APPSFLYER_IOS_APP_ID is required on iOS (numeric App Store id from AppsFlyer / App Store Connect).',
    );
    return;
  }

  try {
    const appsFlyer = (await import('react-native-appsflyer')).default;

    const initOptions =
      Platform.OS === 'ios'
        ? {
            devKey,
            isDebug: __DEV__,
            appId: iosAppId,
            onInstallConversionDataListener: true,
            onDeepLinkListener: true,
            timeToWaitForATTUserAuthorization: 10,
          }
        : {
            devKey,
            isDebug: __DEV__,
            onInstallConversionDataListener: true,
            onDeepLinkListener: true,
          };

    if (!appsFlyerSdkInitialized) {
      await appsFlyer.initSdk(initOptions);
      appsFlyerSdkInitialized = true;
    }
    if (customerUserId.trim().length > 0) {
      appsFlyer.setCustomerUserId(customerUserId.trim());
    }
  } catch (err) {
    console.warn('[rheo-example] AppsFlyer init failed:', err);
  }
};
