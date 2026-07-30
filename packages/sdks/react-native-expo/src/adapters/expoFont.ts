import * as Font from 'expo-font';
import type { FontAdapter } from '@getrheo/react-native-core/platform';

export const expoFontAdapter: FontAdapter = {
  loadFonts: async (fonts) => {
    if (Object.keys(fonts).length === 0) return;
    await Font.loadAsync(fonts);
  },
};
