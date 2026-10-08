export const inferReactNativeRuntimeOs = (): 'ios' | 'android' | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync RN probe; web/Node throws and UA fallback applies
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
  } catch {
    /* not a React Native runtime */
  }
  return null;
};

/** OS and device reported with product-analytics events. Browser stays unset. */
export const nativeProductAnalyticsClient = (): { os?: string; device?: string } => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync RN probe; web/Node throws
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS === 'ios') {
      const constants = Platform.constants as { interfaceIdiom?: string };
      const device = constants.interfaceIdiom === 'pad' ? 'iPad' : 'iPhone';
      const version = typeof Platform.Version === 'string' ? Platform.Version : '';
      return { os: version ? `iOS ${version}` : 'iOS', device };
    }
    if (Platform.OS === 'android') {
      const constants = Platform.constants as { Release?: string; Model?: string; Brand?: string };
      const model = [constants.Brand, constants.Model].filter(Boolean).join(' ');
      return {
        os: constants.Release ? `Android ${constants.Release}` : 'Android',
        ...(model ? { device: model } : {}),
      };
    }
  } catch {
    /* not a React Native runtime */
  }
  return {};
};

export const inferSdkPlatform = (): 'ios' | 'android' | 'web' => {
  const fromRn = inferReactNativeRuntimeOs();
  if (fromRn) return fromRn;
  type G = { navigator?: { userAgent?: string } };
  const ua = (globalThis as G).navigator?.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
};

export const shallowEqualSdkAttrs = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};
