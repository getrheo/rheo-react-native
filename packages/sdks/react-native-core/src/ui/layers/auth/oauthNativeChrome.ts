import { StyleSheet, type ViewStyle } from 'react-native';
import type { OAuthLoginPreset, Padding } from '@getrheo/contracts';
import { rendererOAuthLoginAlignAxis, rendererOAuthPresetBrandModel } from '@getrheo/renderer-core';

export const PRESET_PROVIDER_ICON: Record<OAuthLoginPreset, string> = {
  github: 'logo-github',
  google: 'logo-google',
  apple: 'logo-apple',
};

export const oauthChromePaddingNative = (p: Padding | undefined): ViewStyle =>
  p?.t !== undefined ||
  p?.r !== undefined ||
  p?.b !== undefined ||
  p?.l !== undefined
    ? { paddingTop: p.t, paddingRight: p.r, paddingBottom: p.b, paddingLeft: p.l }
    : { paddingVertical: 12, paddingHorizontal: 16 };

export const oauthChromeMarginNative = (p: Padding | undefined): ViewStyle =>
  p?.t !== undefined || p?.r !== undefined || p?.b !== undefined || p?.l !== undefined
    ? { marginTop: p.t, marginRight: p.r, marginBottom: p.b, marginLeft: p.l }
    : {};

export const oauthPresetBrandNative = (
  preset: OAuthLoginPreset,
  theme: 'light' | 'dark',
): { container: ViewStyle; labelColor: string; iconColor: string; busyColor: string } => {
  const brand = rendererOAuthPresetBrandModel(preset, theme);
  return {
    container: {
      backgroundColor: brand.backgroundColor,
      borderWidth: brand.borderWidth > 0 ? StyleSheet.hairlineWidth * 2 : 0,
      borderColor: brand.borderWidth > 0 ? brand.borderColor : undefined,
    },
    labelColor: brand.labelColor,
    iconColor: brand.iconColor,
    busyColor: brand.iconColor,
  };
};

export const oauthAlignToNative = (
  axis: ReturnType<typeof rendererOAuthLoginAlignAxis>,
): ViewStyle['alignSelf'] => {
  if (axis === 'center') return 'center';
  if (axis === 'end') return 'flex-end';
  if (axis === 'stretch') return 'stretch';
  return 'flex-start';
};
