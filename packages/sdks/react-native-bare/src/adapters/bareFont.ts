import type { FontAdapter } from '@getrheo/react-native-core/platform';
import { getSdkLogger } from '@getrheo/react-native-core';

/**
 * Bare RN has no built-in remote font loader. Prefer bundling faces or adding
 * `expo-font` and swapping this adapter. Until then, branding text falls back
 * to the system font.
 */
export const bareFontAdapter: FontAdapter = {
  loadFonts: async (fonts) => {
    if (Object.keys(fonts).length === 0) return;
    getSdkLogger().warn(
      `[rheo] ${Object.keys(fonts).length} branding font(s) were not registered. ` +
        'Bare React Native does not auto-load remote fonts; use expo-font or pre-link assets, ' +
        'then register with buildBrandingFontLoadMap keys (RheoFont__{styleId}).',
    );
  },
};
