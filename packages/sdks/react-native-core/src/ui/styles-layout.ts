import type { CommonStyle, WidthValue } from '@getrheo/contracts';
import { layerRotateNativeTransform } from '@getrheo/flow-runtime';
import type { ViewStyle as RNViewStyle } from 'react-native';

const widthFractions: Record<Exclude<WidthValue, number>, RNViewStyle['width']> = {
  auto: 'auto',
  full: '100%',
  '1/2': '50%',
  '1/3': '33.3333%',
  '2/3': '66.6667%',
  '1/4': '25%',
  '3/4': '75%',
};

export const widthFor = (w: WidthValue | undefined): RNViewStyle['width'] => {
  if (w === undefined) return undefined;
  if (typeof w === 'number') return w;
  return widthFractions[w];
};

/**
 * Maps {@link CommonStyle} `height` to RN layout height. No fractional
 * values — heights are `auto`, `full`/`fill`, or px.
 */
export const layoutHeightFor = (h: CommonStyle['height']): RNViewStyle['height'] => {
  if (h === undefined) return undefined;
  if (h === 'fill' || h === 'full') return '100%';
  if (h === 'auto') return 'auto';
  return h;
};

/** Default stack cross-axis is stretch; explicit start/center/end must not be overridden on children. */
export const parentAlignUsesCrossAxisStretch = (
  parentAlign: 'start' | 'center' | 'end' | 'stretch' | undefined,
): boolean => parentAlign === 'stretch' || parentAlign === undefined;

/** Flex child stretch when `height: fill` inside a stack (web `stackFlexChildCss` parity). */
export const stackChildHeightFillStyle = (resolved: CommonStyle | undefined): RNViewStyle => {
  const h = resolved?.height;
  if (h !== 'fill' && h !== 'full') return {};
  const widthAuto = resolved?.width === 'auto';
  return {
    flex: widthAuto ? 0 : 1,
    flexShrink: widthAuto ? 0 : 1,
    minHeight: 0,
    alignSelf: 'stretch',
    height: '100%',
  };
};

/** Omit width/height on inner chrome — applied on {@link LayerMotionShell} when a stack flex child. */
export const stripFlowAxesForFlexChild = (
  s: CommonStyle | undefined,
  parentStackDirection: 'vertical' | 'horizontal' | undefined,
): CommonStyle | undefined => {
  if (!s || !parentStackDirection || s.position === 'absolute') return s;
  const out: CommonStyle = { ...s };
  delete out.width;
  delete out.height;
  return Object.keys(out).length ? out : undefined;
};

/**
 * Maps authored width/height presets onto the flex-item wrapper (web `SelectableWrap` parity).
 * RN defaults `flexShrink: 0`, so `width: full` in a row needs `flex: 1` on the wrapper, not `width: 100%` on inner chrome.
 */
export const flowChildLayoutViewStyle = (
  resolved: CommonStyle | undefined,
  parentStackDirection: 'vertical' | 'horizontal' | undefined,
  parentStackAlign?: 'start' | 'center' | 'end' | 'stretch',
): RNViewStyle => {
  if (!resolved || resolved.position === 'absolute') return {};
  const out: RNViewStyle = { ...stackChildHeightFillStyle(resolved) };
  if (!parentStackDirection) return out;

  const crossStretch = parentAlignUsesCrossAxisStretch(parentStackAlign);
  const w = resolved.width;
  if (w === 'full') {
    if (parentStackDirection === 'horizontal') {
      Object.assign(out, {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
      });
      delete out.width;
    } else {
      Object.assign(out, {
        width: '100%',
        ...(crossStretch ? { alignSelf: 'stretch' as const } : {}),
      });
    }
  } else if (w !== undefined && w !== 'auto') {
    out.width = widthFor(w);
  }

  const h = resolved.height;
  if (typeof h === 'number') {
    out.height = h;
  }

  return out;
};

/** Omit wrapper-owned layout keys — mirrors web sim `stripCommonLayoutForInner`. */
export const stripCommonLayoutForInner = (s: CommonStyle | undefined): CommonStyle | undefined => {
  if (!s) return undefined;
  const wasAbsolute = s.position === 'absolute';
  const out: CommonStyle = { ...s };
  delete out.zIndex;
  delete out.rotate;
  delete out.position;
  delete out.inset;
  if (wasAbsolute) {
    delete out.width;
    delete out.height;
  }
  return Object.keys(out).length ? out : undefined;
};

/** z-index and absolute box — applied on the wrapping View (flex parent). */
export const wrapperLayoutViewStyle = (resolved: CommonStyle | undefined): RNViewStyle => {
  if (!resolved) return {};
  const out: RNViewStyle = {};
  if (resolved.zIndex !== undefined) out.zIndex = resolved.zIndex;
  const rotate = layerRotateNativeTransform(resolved.rotate);
  if (rotate !== undefined) out.transform = rotate;
  if (resolved.position === 'absolute') {
    out.position = 'absolute';
    const ins = resolved.inset;
    if (ins?.t !== undefined) out.top = ins.t;
    if (ins?.r !== undefined) out.right = ins.r;
    if (ins?.b !== undefined) out.bottom = ins.b;
    if (ins?.l !== undefined) out.left = ins.l;
    const wf = widthFor(resolved.width);
    if (wf !== undefined) out.width = wf;
    const hf = layoutHeightFor(resolved.height);
    if (hf !== undefined) out.height = hf;
  }
  return out;
};

const distributionMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
} as const;

export const justifyFor = (
  d: 'start' | 'center' | 'end' | 'between' | 'around' | undefined,
): RNViewStyle['justifyContent'] =>
  d ? distributionMap[d] : undefined;

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const;

export const alignFor = (
  a: 'start' | 'center' | 'end' | 'stretch' | undefined,
): RNViewStyle['alignItems'] => (a ? alignMap[a] : undefined);
