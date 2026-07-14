import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX, buildTwoStopLinearGradientCss } from '@getrheo/flow-runtime';
import { describe, expect, it } from 'vitest';
import {
  alignFor,
  borderStyle,
  buttonChromeLayoutStyle,
  buttonPalette,
  commonViewStylePair,
  justifyFor,
  layoutHeightFor,
  mergeButtonInlineLabelStyle,
  flowChildLayoutViewStyle,
  mediaChromeFillsMotionShell,
  mediaLayerOuterLayoutPair,
  screenContainerChromeInsets,
  stackChildHeightFillStyle,
  stripFlowAxesForFlexChild,
  stripCommonLayoutForInner,
  textContainerViewStylePair,
  widthFor,
  wrapperLayoutViewStyle,
} from './styles';

const brandGradientPreset: BrandGradient = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'G1',
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#ff0000', offset: 0 },
    { color: '#0000ff', offset: 1 },
  ],
};

const brandGradientBranding: Branding = {
  gradientPresets: [brandGradientPreset],
  colorPresets: [],
  fontFamilies: [],
};

const brandGradientToken = `${BRAND_GRADIENT_PREFIX}${brandGradientPreset.id}`;

describe('native styles parity', () => {
  it('widthFor maps presets and numeric widths', () => {
    expect(widthFor(undefined)).toBeUndefined();
    expect(widthFor(120)).toBe(120);
    expect(widthFor('full')).toBe('100%');
    expect(widthFor('1/2')).toBe('50%');
    expect(widthFor('2/3')).toBe('66.6667%');
  });

  it('layoutHeightFor maps fill, full, auto, fractions, and px', () => {
    expect(layoutHeightFor('fill')).toBe('100%');
    expect(layoutHeightFor('full')).toBe('100%');
    expect(layoutHeightFor('auto')).toBe('auto');
    expect(layoutHeightFor(120)).toBe(120);
    expect(layoutHeightFor('1/2')).toBe('50%');
    expect(layoutHeightFor('2/3')).toBe('66.6667%');
    expect(layoutHeightFor(undefined)).toBeUndefined();
  });

  it('stackChildHeightFillStyle applies flex stretch for fill height', () => {
    expect(stackChildHeightFillStyle({ height: 'fill', width: 'full' })).toMatchObject({
      flex: 1,
      alignSelf: 'stretch',
      height: '100%',
      minHeight: 0,
    });
    expect(stackChildHeightFillStyle({ height: 'auto' })).toEqual({});
  });

  it('flowChildLayoutViewStyle uses flex grow for width full in a horizontal stack', () => {
    expect(
      flowChildLayoutViewStyle({ width: 'full', height: 'fill' }, 'horizontal'),
    ).toMatchObject({
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      alignSelf: 'stretch',
      height: '100%',
    });
    expect(flowChildLayoutViewStyle({ width: 'full' }, 'horizontal').width).toBeUndefined();
    expect(flowChildLayoutViewStyle({ width: 'full' }, 'horizontal', 'center').alignSelf).toBeUndefined();
  });

  it('flowChildLayoutViewStyle uses percent width in a vertical stack', () => {
    expect(flowChildLayoutViewStyle({ width: 'full' }, 'vertical')).toMatchObject({
      width: '100%',
      alignSelf: 'stretch',
    });
  });

  it('flowChildLayoutViewStyle applies fractional height inside a parent stack', () => {
    expect(flowChildLayoutViewStyle({ width: 'full', height: '1/2' }, 'vertical')).toMatchObject({
      width: '100%',
      height: '50%',
    });
  });

  it('flowChildLayoutViewStyle applies pixel height inside a parent stack', () => {
    expect(flowChildLayoutViewStyle({ width: 120, height: 88 }, 'vertical')).toMatchObject({
      width: 120,
      height: 88,
    });
  });

  it('flowChildLayoutViewStyle emits authored maxWidth on a flex child shell', () => {
    expect(
      flowChildLayoutViewStyle({ width: 'full', maxWidth: 100 }, 'horizontal'),
    ).toMatchObject({
      flex: 1,
      maxWidth: 100,
    });
  });

  it('mediaChromeFillsMotionShell stretches chrome when authored size is explicit', () => {
    expect(mediaChromeFillsMotionShell({ width: 120, height: 120 }, 'vertical')).toMatchObject({
      flex: 1,
      width: '100%',
      height: '100%',
    });
    expect(mediaChromeFillsMotionShell({ width: 'auto', height: 'auto' }, 'vertical')).toEqual({});
  });

  it('stripFlowAxesForFlexChild removes width and height for stack children', () => {
    expect(
      stripFlowAxesForFlexChild(
        {
          width: 'full',
          height: 'fill',
          maxWidth: 100,
          minHeight: 40,
          padding: { t: 1, r: 1, b: 1, l: 1 },
        },
        'horizontal',
      ),
    ).toEqual({ padding: { t: 1, r: 1, b: 1, l: 1 } });
  });

  it('stripCommonLayoutForInner omits position keys for absolute layers', () => {
    const stripped = stripCommonLayoutForInner({
      position: 'absolute',
      inset: { t: 1, l: 2 },
      width: 'full',
      height: 'fill',
      zIndex: 2,
      padding: { t: 4, r: 4, b: 4, l: 4 },
    });
    expect(stripped).toEqual({ padding: { t: 4, r: 4, b: 4, l: 4 } });
  });

  it('wrapperLayoutViewStyle resolves zIndex and absolute inset', () => {
    expect(
      wrapperLayoutViewStyle({
        position: 'absolute',
        inset: { t: 8, r: 12 },
        width: '1/2',
        zIndex: 5,
      }),
    ).toMatchObject({
      position: 'absolute',
      top: 8,
      right: 12,
      width: '50%',
      zIndex: 5,
    });
  });

  it('wrapperLayoutViewStyle resolves authored rotation', () => {
    expect(wrapperLayoutViewStyle({ rotate: 30 })).toMatchObject({
      transform: [{ rotate: '30deg' }],
    });
  });

  it('stripCommonLayoutForInner omits rotate', () => {
    const stripped = stripCommonLayoutForInner({
      rotate: 45,
      padding: { t: 4, r: 4, b: 4, l: 4 },
    });
    expect(stripped).toEqual({ padding: { t: 4, r: 4, b: 4, l: 4 } });
  });

  it('inner strip chain applies stripFlowAxesForFlexChild before stripCommonLayoutForInner', () => {
    const stripped = stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(
        {
          width: 'full',
          height: 'fill',
          zIndex: 2,
          rotate: 45,
          padding: { t: 4, r: 4, b: 4, l: 4 },
        },
        'horizontal',
      ),
    );
    expect(stripped).toEqual({ padding: { t: 4, r: 4, b: 4, l: 4 } });
  });

  it('borderStyle resolves themed border color', () => {
    expect(
      borderStyle({ width: 1, color: { light: '#e4e4e7', dark: '#3f3f46' } }, undefined, 'dark'),
    ).toMatchObject({
      borderWidth: 1,
      borderColor: '#3f3f46',
    });
  });

  it('buttonPalette returns primary fill vs ghost border', () => {
    const primary = buttonPalette('primary', 'light');
    const ghost = buttonPalette('ghost', 'light');
    expect(primary.background).not.toBe(ghost.background);
    expect(ghost.border).toBeTruthy();
  });

  it('mergeButtonInlineLabelStyle prefers explicit text color over variant chrome', () => {
    const palette = buttonPalette('primary', 'dark');
    const merged = mergeButtonInlineLabelStyle(
      palette,
      undefined,
      { color: '#ff00ff' },
      undefined,
      'dark',
    );
    expect(merged.color).toBe('#ff00ff');
  });

  it('mergeButtonInlineLabelStyle does not apply fontSize/weight/align defaults onto text children', () => {
    const palette = buttonPalette('primary', 'dark');
    const merged = mergeButtonInlineLabelStyle(palette, undefined, undefined, undefined, 'dark');
    expect(merged.fontSize).toBeUndefined();
    expect(merged.fontWeight).toBeUndefined();
    expect(merged.textAlign).toBeUndefined();
    expect(merged.color).toBe(palette.color);
  });

  it('mergeButtonInlineLabelStyle: text child fontSize 20 wins', () => {
    const palette = buttonPalette('primary', 'dark');
    const merged = mergeButtonInlineLabelStyle(
      palette,
      { fontSize: 13, fontWeight: 600 },
      { fontSize: 20 },
      undefined,
      'dark',
    );
    expect(merged.fontSize).toBe(20);
    expect(merged.color).toBe(palette.color);
  });

  it('mergeButtonInlineLabelStyle prefers text-child typography over button chrome (web parity)', () => {
    const palette = buttonPalette('primary', 'dark');
    const merged = mergeButtonInlineLabelStyle(
      palette,
      { color: '#ffffff', fontSize: 13, fontWeight: 600 },
      { color: { light: '#ffffff', dark: '#000000' }, fontSize: 24, fontWeight: 300 },
      undefined,
      'dark',
    );
    expect(merged.color).toBe('#000000');
    expect(merged.fontSize).toBe(24);
    expect(merged.fontWeight).toBe('300');
  });

  it('buttonChromeLayoutStyle hugs content height unless height fill is authored', () => {
    expect(buttonChromeLayoutStyle({ width: 'full' })).toMatchObject({
      width: '100%',
      alignSelf: 'stretch',
    });
    expect(buttonChromeLayoutStyle({ width: 'full' }).height).toBeUndefined();
    expect(buttonChromeLayoutStyle({ width: 'full', height: 'fill' })).toMatchObject({
      flex: 1,
      height: '100%',
    });
  });

  it('buttonChromeLayoutStyle hugs the main axis in a horizontal stack (back button parity with web)', () => {
    // No authored width in a horizontal stack: the button hugs and is positioned
    // by the parent stack's justify/align — it must NOT span the header width
    // (which would otherwise center a default-distribution back button icon).
    const hug = buttonChromeLayoutStyle(undefined, 'horizontal');
    expect(hug.width).toBeUndefined();
    expect(hug.alignSelf).toBeUndefined();
    // Authored width:full still fills the (grown) flow shell on the main axis.
    expect(buttonChromeLayoutStyle({ width: 'full' }, 'horizontal').width).toBe('100%');
    // Vertical stacks keep the full-width default (e.g. a footer Continue button).
    expect(buttonChromeLayoutStyle({ width: 'full' }, 'vertical')).toMatchObject({
      width: '100%',
      alignSelf: 'stretch',
    });
  });

  it('justifyFor and alignFor map flex enums', () => {
    expect(justifyFor('between')).toBe('space-between');
    expect(alignFor('stretch')).toBe('stretch');
  });

  it('screenContainerChromeInsets maps screen shell padding and margin', () => {
    expect(
      screenContainerChromeInsets({ t: 12, r: 16, b: 12, l: 16 }, { t: 4, r: 0, b: 4, l: 0 }),
    ).toEqual({
      paddingTop: 12,
      paddingRight: 16,
      paddingBottom: 12,
      paddingLeft: 16,
      marginTop: 4,
      marginRight: 0,
      marginBottom: 4,
      marginLeft: 0,
    });
  });

  it('mediaLayerOuterLayoutPair sets overflow hidden for brand gradient background', () => {
    const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
      { background: brandGradientToken, width: 120, height: 120, radius: 8 },
      undefined,
      'light',
      brandGradientBranding,
    );
    expect(linearGradient).not.toBeNull();
    expect(outerStyle.overflow).toBe('hidden');
  });

  it('mediaLayerOuterLayoutPair omits overflow for solid background', () => {
    const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
      { background: { light: '#ffffff', dark: '#000000' }, width: 120, height: 120 },
      undefined,
      'dark',
    );
    expect(linearGradient).toBeNull();
    expect(outerStyle.overflow).toBeUndefined();
    expect('overflow' in outerStyle).toBe(false);
  });

  it('mediaLayerOuterLayoutPair sets overflow hidden for authored linear-gradient CSS', () => {
    const css = buildTwoStopLinearGradientCss(180, '#ffffff', '#000000');
    const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
      { background: css, width: 'full', height: 80 },
      undefined,
      'light',
    );
    expect(linearGradient).not.toBeNull();
    expect(outerStyle.overflow).toBe('hidden');
  });

  it('commonViewStylePair emits authored size clamps', () => {
    expect(
      commonViewStylePair({ maxWidth: 100, minHeight: 24 }, undefined, 'light').style,
    ).toMatchObject({
      maxWidth: 100,
      minHeight: 24,
    });
  });

  it('commonViewStylePair exposes linearGradient for brand gradient (layer overflow clip pattern)', () => {
    const pair = commonViewStylePair(
      { background: brandGradientToken, radius: 12 },
      undefined,
      'light',
      brandGradientBranding,
    );
    expect(pair.linearGradient).not.toBeNull();
    expect(pair.style.backgroundColor).toBeUndefined();
    // Layer shells (layoutLayers, actionLayers, …) apply overflow when linearGradient is set.
    expect(pair.linearGradient ? 'hidden' : undefined).toBe('hidden');
  });

  it('textContainerViewStylePair exposes linearGradient for brand gradient (layer overflow clip pattern)', () => {
    const pair = textContainerViewStylePair(
      { background: brandGradientToken, backgroundOpacity: 0.8, radius: 4 },
      undefined,
      'light',
      brandGradientBranding,
    );
    expect(pair.linearGradient).not.toBeNull();
    // Layer shells apply overflow hidden when linearGradient is present.
    expect(pair.linearGradient ? 'hidden' : undefined).toBe('hidden');
    // backgroundOpacity dims gradient stop colors (solid path parity).
    expect(pair.linearGradient!.colors).toEqual(['rgba(255,0,0,0.8)', 'rgba(0,0,255,0.8)']);
  });

  it('commonViewStylePair applies background opacity without container opacity', () => {
    const pair = commonViewStylePair(
      { background: '#ff0000', backgroundOpacity: 0.5 },
      undefined,
      'light',
    );
    expect(pair.style.backgroundColor).toBe('rgba(255,0,0,0.5)');
    expect(pair.style.opacity).toBeUndefined();
  });

  it('commonViewStylePair treats legacy background opacity as fill-only', () => {
    const pair = commonViewStylePair(
      { background: '#ff0000', opacity: 0.5 },
      undefined,
      'light',
    );
    expect(pair.style.backgroundColor).toBe('rgba(255,0,0,0.5)');
    expect(pair.style.opacity).toBeUndefined();
  });
});
