import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
import { OAUTH_LOGIN_PRESETS } from '@getrheo/contracts/layers';
import { rendererOAuthLoginAlignAxis, rendererOAuthPresetBrandModel } from '@getrheo/renderer-core';
import {
  oauthAlignToNative,
  oauthPresetBrandNative,
  PRESET_PROVIDER_ICON,
} from './oauthNativeChrome';

describe('oauthNativeChrome parity', () => {
  it.each(
    OAUTH_LOGIN_PRESETS.flatMap((preset) =>
      (['light', 'dark'] as const).map((theme) => ({ preset, theme })),
    ),
  )('oauthPresetBrandNative aligns with rendererOAuthPresetBrandModel for $preset/$theme', ({
    preset,
    theme,
  }) => {
    const core = rendererOAuthPresetBrandModel(preset, theme);
    const native = oauthPresetBrandNative(preset, theme);
    expect(native.labelColor).toBe(core.labelColor);
    expect(native.iconColor).toBe(core.iconColor);
    expect(native.container.backgroundColor).toBe(core.backgroundColor);
  });

  it('oauthAlignToNative maps axis to alignSelf', () => {
    expect(oauthAlignToNative(rendererOAuthLoginAlignAxis('center'))).toBe('center');
    expect(oauthAlignToNative(rendererOAuthLoginAlignAxis('end'))).toBe('flex-end');
    expect(oauthAlignToNative(rendererOAuthLoginAlignAxis('stretch'))).toBe('stretch');
    expect(oauthAlignToNative(rendererOAuthLoginAlignAxis(undefined))).toBe('flex-start');
  });

  it('PRESET_PROVIDER_ICON covers every OAuthLoginPreset', () => {
    for (const preset of OAUTH_LOGIN_PRESETS) {
      expect(PRESET_PROVIDER_ICON[preset]).toBeTruthy();
    }
  });
});
