import { describe, expect, it } from 'vitest';
import {
  alignFor,
  borderStyle,
  buttonChromeLayoutStyle,
  buttonPalette,
  justifyFor,
  layoutHeightFor,
  mergeButtonInlineLabelStyle,
  flowChildLayoutViewStyle,
  mediaChromeFillsMotionShell,
  screenContainerChromeInsets,
  stackChildHeightFillStyle,
  stripFlowAxesForFlexChild,
  stripCommonLayoutForInner,
  widthFor,
  wrapperLayoutViewStyle,
} from './styles';

describe('native styles parity', () => {
  it('widthFor maps presets and numeric widths', () => {
    expect(widthFor(undefined)).toBeUndefined();
    expect(widthFor(120)).toBe(120);
    expect(widthFor('full')).toBe('100%');
    expect(widthFor('1/2')).toBe('50%');
    expect(widthFor('2/3')).toBe('66.6667%');
  });

  it('layoutHeightFor maps fill, full, auto, and px (no fractional heights)', () => {
    expect(layoutHeightFor('fill')).toBe('100%');
    expect(layoutHeightFor('full')).toBe('100%');
    expect(layoutHeightFor('auto')).toBe('auto');
    expect(layoutHeightFor(120)).toBe(120);
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

  it('flowChildLayoutViewStyle applies pixel height inside a parent stack', () => {
    expect(flowChildLayoutViewStyle({ width: 120, height: 88 }, 'vertical')).toMatchObject({
      width: 120,
      height: 88,
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
      stripFlowAxesForFlexChild({ width: 'full', height: 'fill', padding: { t: 1, r: 1, b: 1, l: 1 } }, 'horizontal'),
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

  it('mergeButtonInlineLabelStyle prefers button chrome color over text child (web parity)', () => {
    const palette = buttonPalette('primary', 'dark');
    const merged = mergeButtonInlineLabelStyle(
      palette,
      { color: '#ffffff' },
      { color: { light: '#ffffff', dark: '#000000' } },
      undefined,
      'dark',
    );
    expect(merged.color).toBe('#ffffff');
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
});
