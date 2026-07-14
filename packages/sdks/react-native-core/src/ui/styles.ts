import { Branding } from '@getrheo/contracts/branding';
import type { Border, ButtonStyle, CommonStyle, ImageStyle as LayerImageStyle, Padding, TextStyle as LayerTextStyle, Theme } from '@getrheo/contracts';

import type {BrandGradientNativeLinear} from '@getrheo/flow-runtime';
import { DEFAULT_THEMED_FOREGROUND } from '@getrheo/contracts';
import { nativeBrandBackgroundFromThemedColor, resolveThemedColor, buttonVariantChromeForTheme, multiplyColorAlpha, resolveCommonBackgroundOpacity, resolveCommonLayerOpacity, resolveNativeTextFontFamilyName, TEXT_FONT_FAMILY_SYSTEM_UI } from '@getrheo/flow-runtime';
import { scaleAuthoredFontSize } from '@getrheo/renderer-core';
import type { ButtonLayerVariant } from '@getrheo/contracts';
import { dropShadowToNativeStyle } from '@getrheo/flow-runtime';
import type {ImageStyle as RNImageStyle, TextStyle as RNTextStyle, ViewStyle as RNViewStyle, } from 'react-native';
import {
  layoutHeightFor,
  stackChildHeightFillStyle,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
} from './styles-layout';

export {
  alignFor,
  flowChildLayoutViewStyle,
  justifyFor,
  layoutHeightFor,
  parentAlignUsesCrossAxisStretch,
  stackChildHeightFillStyle,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
  wrapperLayoutViewStyle,
} from './styles-layout';

export type TextLayerStyleOptions = {
  /**
   * When true and `s.color` is omitted, use {@link DEFAULT_THEMED_FOREGROUND}
   * (matches web sim root `color` inheritance). Omit for text merged with
   * button chrome ({@link mergeButtonInlineLabelStyle}).
   */
  inheritDocumentForeground?: boolean;
  /** When set, custom branding fonts resolve to native-linked face names. */
  branding?: Branding;
  /** System text scale (`useWindowDimensions().fontScale`); default 1. */
  fontScale?: number;
};

/**
 * Native style helpers — port of the DOM `commonCss/textCss/buttonCss/...`
 * helpers in `@rheo/renderer-web/LayerRenderer.tsx`. Keep this file in
 * lockstep with the DOM version when the layer schema evolves.
 *
 * Text color: on web, `LayerRenderer` sets a root `color` so layers without
 * `style.color` inherit {@link DEFAULT_THEMED_FOREGROUND}. RN `<Text>` does not
 * inherit color from `<View>`. Standalone text layers pass
 * `{ inheritDocumentForeground: true }` so they match the canvas; inline
 * button labels omit it so {@link mergeButtonInlineLabelStyle} can prefer
 * variant chrome over an implicit body foreground.
 */

export const paddingStyle = (p: Padding | undefined): RNViewStyle =>
  p
    ? { paddingTop: p.t, paddingRight: p.r, paddingBottom: p.b, paddingLeft: p.l }
    : {};

export const marginStyle = (p: Padding | undefined): RNViewStyle =>
  p
    ? { marginTop: p.t, marginRight: p.r, marginBottom: p.b, marginLeft: p.l }
    : {};

/** Screen `containerStyle` padding/margin — always applied on the shell, including media backdrops. */
export const screenContainerChromeInsets = (
  padding: Padding | undefined,
  margin: Padding | undefined,
): RNViewStyle => ({
  ...paddingStyle(padding),
  ...marginStyle(margin),
});

export const borderStyle = (
  b: Border | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
): RNViewStyle =>
  b
    ? {
        borderStyle: 'solid',
        borderWidth: b.width,
        borderColor: resolveThemedColor(theme, palette, b.color) as string | undefined,
      }
    : {};

/** RN style arrays / merges treat explicit `undefined` as a reset; omit keys instead. */
const omitUndefinedStyleKeys = (o: Record<string, unknown>): RNViewStyle => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out as RNViewStyle;
};

export const commonViewStylePair = (
  s: CommonStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): { style: RNViewStyle; linearGradient: BrandGradientNativeLinear | null } => {
  const inner = stripCommonLayoutForInner(s);
  if (!inner) return { style: {}, linearGradient: null };
  const nb = nativeBrandBackgroundFromThemedColor(theme, branding, palette, inner.background);
  const { background: _b, backgroundOpacity: _bo, ...rest } = inner;
  const bgColor =
    nb.solid !== undefined
      ? multiplyColorAlpha(nb.solid, resolveCommonBackgroundOpacity(inner))
      : undefined;
  const style = omitUndefinedStyleKeys({
    ...paddingStyle(rest.padding),
    ...marginStyle(rest.margin),
    borderRadius: rest.radius,
    backgroundColor: bgColor,
    opacity: resolveCommonLayerOpacity(inner),
    width: widthFor(rest.width),
    height: layoutHeightFor(rest.height),
    minWidth: rest.minWidth,
    maxWidth: rest.maxWidth,
    minHeight: rest.minHeight,
    maxHeight: rest.maxHeight,
    ...borderStyle(rest.border, theme, palette),
    ...dropShadowToNativeStyle(rest.shadow, theme, palette),
  });
  return { style, linearGradient: nb.linear ?? null };
};

export const commonViewStyle = (
  s: CommonStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): RNViewStyle => commonViewStylePair(s, theme, palette, branding).style;

/**
 * Outer View chrome for text / counter layers: same as {@link commonViewStyle} but applies
 * {@link LayerTextStyle.backgroundOpacity} only to the background fill (matches web `textCss`),
 * including linear gradient underlay stop colors.
 */
export const textContainerViewStylePair = (
  s: LayerTextStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): { style: RNViewStyle; linearGradient: BrandGradientNativeLinear | null } => {
  if (!s) return { style: {}, linearGradient: null };
  const inner = stripCommonLayoutForInner(s);
  if (!inner) return { style: {}, linearGradient: null };
  const styled = inner as LayerTextStyle;
  const nb = nativeBrandBackgroundFromThemedColor(theme, branding, palette, styled.background);
  const bgColor =
    nb.solid !== undefined
      ? multiplyColorAlpha(nb.solid, resolveCommonBackgroundOpacity(styled))
      : undefined;
  const { background: _bg, backgroundOpacity: _bo, ...chromeOnly } = styled;
  const base = commonViewStylePair(chromeOnly, theme, palette, branding);
  const linearGradient =
    nb.linear == null
      ? null
      : styled.backgroundOpacity === undefined || styled.backgroundOpacity >= 1
        ? nb.linear
        : {
            ...nb.linear,
            colors: nb.linear.colors.map(
              (c) => multiplyColorAlpha(c, styled.backgroundOpacity) ?? c,
            ),
          };
  return {
    style: omitUndefinedStyleKeys({
      ...base.style,
      ...(bgColor !== undefined ? { backgroundColor: bgColor } : {}),
    }),
    linearGradient,
  };
};

export const textContainerViewStyle = (
  s: LayerTextStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): RNViewStyle => textContainerViewStylePair(s, theme, palette, branding).style;

export const textLayerStyle = (
  s: LayerTextStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  options?: TextLayerStyleOptions,
): RNTextStyle => {
  if (!s) return {};
  const colorInput =
    options?.inheritDocumentForeground === true && s.color === undefined
      ? DEFAULT_THEMED_FOREGROUND
      : s.color;
  const layerFont = s.fontFamily?.trim();
  let logical: string | undefined;
  if (layerFont === TEXT_FONT_FAMILY_SYSTEM_UI) logical = TEXT_FONT_FAMILY_SYSTEM_UI;
  else if (layerFont) logical = layerFont;
  else if (theme?.fontFamily?.trim()) logical = theme.fontFamily.trim();
  else logical = undefined;
  const fontFamily = resolveNativeTextFontFamilyName(options?.branding, logical, s.fontWeight);
  const fontScale = options?.fontScale ?? 1;
  const fontSize = scaleAuthoredFontSize(s.fontSize, fontScale);
  return omitUndefinedStyleKeys({
    fontFamily,
    fontSize,
    fontWeight: s.fontWeight ? (String(s.fontWeight) as RNTextStyle['fontWeight']) : undefined,
    color: resolveThemedColor(theme, palette, colorInput) as string | undefined,
    textAlign: s.align,
    lineHeight:
      s.lineHeight && fontSize ? s.lineHeight * fontSize : undefined,
    letterSpacing:
      s.letterSpacing !== undefined && fontSize
        ? s.letterSpacing * fontSize
        : undefined,
  });
};

export const buttonContentStyle = (
  s: ButtonStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  fontScale = 1,
): RNTextStyle => {
  if (!s) return {};
  return omitUndefinedStyleKeys({
    fontSize: scaleAuthoredFontSize(s.fontSize, fontScale),
    fontWeight: s.fontWeight ? (String(s.fontWeight) as RNTextStyle['fontWeight']) : undefined,
    color: resolveThemedColor(theme, palette, s.color) as string | undefined,
    textAlign: s.align,
  });
};

export const imageBoxStyle = (
  s: LayerImageStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): RNImageStyle => imageBoxStylePair(s, theme, palette, branding).style;

export const imageBoxStylePair = (
  s: LayerImageStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
): { style: RNImageStyle; linearGradient: BrandGradientNativeLinear | null } => {
  if (!s) return { style: {}, linearGradient: null };
  const common = commonViewStylePair(s, theme, palette, branding);
  return {
    style: omitUndefinedStyleKeys({
      ...(common.style as Record<string, unknown>),
      height: s.height === 'fill' ? ('100%' as const) : s.height,
      aspectRatio: s.aspectRatio,
    }) as RNImageStyle,
    linearGradient: common.linearGradient,
  };
};

/**
 * Outer chrome for image/lottie/video layers. The flex-shell on
 * {@link LayerMotionShell} owns wrapper layout and flow-axes; this helper
 * only applies chrome (padding/border/radius/etc) plus width/height when
 * the layer is not in a parent stack.
 */
export const mediaLayerOuterLayoutPair = (
  resolved: LayerImageStyle | undefined,
  theme: Theme | undefined,
  palette: 'light' | 'dark',
  branding?: Branding,
  parentStackDirection?: 'vertical' | 'horizontal',
): { outerStyle: RNViewStyle; linearGradient: BrandGradientNativeLinear | null } => {
  const stripped = stripCommonLayoutForInner(
    stripFlowAxesForFlexChild(resolved, parentStackDirection),
  );
  const { style: chrome, linearGradient } = commonViewStylePair(stripped, theme, palette, branding);
  const { width: _cw, height: _ch, ...chromeNoAxes } = chrome;
  const isAbsolute = resolved?.position === 'absolute';
  const inFlex = parentStackDirection !== undefined;
  return {
    outerStyle: omitUndefinedStyleKeys({
      ...chromeNoAxes,
      width: isAbsolute || inFlex ? undefined : widthFor(resolved?.width),
      height: isAbsolute || inFlex ? undefined : layoutHeightFor(resolved?.height),
      aspectRatio: resolved?.aspectRatio,
      overflow: linearGradient ? 'hidden' : undefined,
    }),
    linearGradient,
  };
};

/** Inner media surface fills the outer chrome box. No implicit min-height. */
export const mediaLayerInnerFillStyle = (resolved: LayerImageStyle | undefined): RNViewStyle => {
  const rawH = resolved?.height;
  const fillsHeight =
    rawH === 'fill' || rawH === 'full' || typeof rawH === 'number';
  return omitUndefinedStyleKeys({
    ...(fillsHeight ? { flex: 1, width: '100%', height: '100%' } : {}),
    minWidth: 0,
    minHeight: 0,
  });
};

/**
 * Media chrome should stretch to the flex-shell when the authored box has an
 * explicit size or fill axis — otherwise the shell has dimensions but the
 * inner chrome collapses to 0×0 (web img/lottie fill their shell via CSS).
 */
export const mediaChromeFillsMotionShell = (
  resolved: LayerImageStyle | undefined,
  parentStackDirection: 'vertical' | 'horizontal' | undefined,
): RNViewStyle => {
  if (!parentStackDirection || !resolved) return {};
  const hugWidth = resolved.width === 'auto' || resolved.width === undefined;
  const hugHeight = resolved.height === 'auto' || resolved.height === undefined;
  if (hugWidth && hugHeight) return {};
  return { flex: 1, width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
};

export type ButtonVariantPalette = {
  background: string;
  color: string;
  border: string;
};

export const buttonPalette = (
  variant: ButtonLayerVariant,
  theme: 'light' | 'dark',
): ButtonVariantPalette => {
  const c = buttonVariantChromeForTheme(variant, theme);
  return {
    background: c.bg,
    color: c.color,
    border: c.border,
  };
};

/**
 * RN does not inherit typography from parent Views onto `<Text>`.
 * Variant color fills when the text child omits color; fontSize / weight / align
 * defaults are not applied onto text children (authored text style wins or stays unset).
 */
export const mergeButtonInlineLabelStyle = (
  palette: ButtonVariantPalette,
  buttonStyle: ButtonStyle | undefined,
  textStyle: LayerTextStyle | undefined,
  theme: Theme | undefined,
  paletteMode: 'light' | 'dark',
  branding?: Branding,
  fontScale = 1,
): RNTextStyle => {
  const btnS = buttonContentStyle(buttonStyle, theme, paletteMode, fontScale);
  const textS = textLayerStyle(textStyle, theme, paletteMode, { branding, fontScale });
  const pickDefined = (o: RNTextStyle): RNTextStyle => {
    const out: RNTextStyle = {};
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    return out;
  };
  const btnDefined = pickDefined(btnS);
  const textDefined = pickDefined(textS);
  // Match web `mergeButtonInlineLabelCss` — button chrome fills gaps; text child wins.
  // No default fontSize 13 / weight 600 / textAlign center onto text children.
  return {
    ...btnDefined,
    ...textDefined,
    color: textS.color ?? btnS.color ?? palette.color,
  };
};

/**
 * Inner button pressable sizing. Width follows the flex-shell wrapper; height hugs
 * content unless the author sets `height: fill` (SwiftUI / web sim parity).
 */
export const buttonChromeLayoutStyle = (
  resolved: ButtonStyle | undefined,
  parentStackDirection?: 'vertical' | 'horizontal',
): RNViewStyle => {
  const heightFill = resolved?.height === 'fill' || resolved?.height === 'full';
  const inHorizontalStack = parentStackDirection === 'horizontal';
  // In a horizontal stack a button hugs its content on the main axis unless it
  // authors an explicit width (full/fraction/px) — the flow shell sizes those.
  // Mirrors web, where `width:100%` lands on the inner pressable and the flex
  // child follows the flow model, so e.g. a back button never spans the header.
  const hugMainAxis =
    inHorizontalStack && (resolved?.width === undefined || resolved?.width === 'auto');
  return omitUndefinedStyleKeys({
    ...(hugMainAxis ? {} : { width: '100%' }),
    ...(inHorizontalStack ? {} : { alignSelf: 'stretch' }),
    ...(heightFill ? stackChildHeightFillStyle(resolved) : {}),
    ...(typeof resolved?.height === 'number' ? { height: resolved.height } : {}),
  });
};
