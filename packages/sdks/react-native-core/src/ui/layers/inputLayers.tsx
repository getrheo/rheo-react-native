import { Fragment } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';
import type { CheckboxLayer, ScaleInputLayer, TextInputLayer } from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import { dropShadowToNativeStyle, resolveNativeTextFontFamilyName, snapScaleValue } from '@getrheo/flow-runtime';
import { resolveScaleInputSliderForRender } from '@getrheo/flow-runtime/scaleInputStyle';
import { resolveCheckboxGlyphForRender, scaleAuthoredFontSize } from '@getrheo/renderer-core';
import { useScreenCheckboxAck } from '@getrheo/flow-ui-state';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import { DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX, resolveCommonStyleAtWidth } from '@getrheo/flow-runtime';
import {
  commonViewStylePair,
  layoutHeightFor,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
  wrapperLayoutViewStyle,
} from '../styles';

export const CheckboxView = ({ layer, ctx }: { layer: CheckboxLayer; ctx: Ctx }) => {
  const ack = useScreenCheckboxAck();
  const checked = ack?.checked[layer.fieldKey] ?? false;
  const resolved = resolveCheckboxGlyphForRender(
    ctx.manifest.theme,
    ctx.theme,
    layer.uncheckedStyle,
    layer.checkedStyle,
    checked,
    ctx.branding,
  );
  const markSize = Math.max(10, Math.round(resolved.sizePx * 0.58));
  const boxStyle: ViewStyle = {
    width: resolved.sizePx,
    height: resolved.sizePx,
    borderRadius: resolved.radiusPx,
    backgroundColor: resolved.nativeBackgroundColor,
    opacity: resolved.opacity,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: resolved.borderWidth,
    borderColor: resolved.borderColor,
    borderStyle: resolved.borderWidth !== undefined && resolved.borderWidth > 0 ? 'solid' : undefined,
    ...dropShadowToNativeStyle(resolved.shadow, ctx.manifest.theme, ctx.theme),
  };
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const wrap = wrapperLayoutViewStyle(resolvedOuter);
  const inner = stripCommonLayoutForInner(
    stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection),
  );
  const { style: common, linearGradient } = commonViewStylePair(
    inner,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const flowWidth =
    resolvedOuter?.position === 'absolute' ? undefined : (widthFor(resolvedOuter?.width) ?? '100%');
  const outerStyle: ViewStyle = {
    ...wrap,
    ...common,
    width: wrap.width ?? flowWidth,
    height: wrap.height ?? layoutHeightFor(resolvedOuter?.height),
    overflow: linearGradient ? 'hidden' : undefined,
    alignSelf: 'stretch',
  };
  return (
    <View style={outerStyle}>
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      disabled={!ctx.interactive}
      onPress={() => {
        if (!ctx.interactive) return;
        ack?.toggle(layer.fieldKey);
      }}
      style={{ opacity: ctx.interactive ? 1 : 0.55 }}
    >
      <ChromeView style={boxStyle} linearGradient={resolved.nativeLinearGradient}>
        {checked ? (
          <Text
            style={{
              color: resolved.checkColor ?? (ctx.theme === 'dark' ? '#18181b' : '#ffffff'),
              fontSize: markSize,
              fontWeight: '700',
              lineHeight: Math.round(markSize * 1.05),
            }}
          >
            ✓
          </Text>
        ) : null}
      </ChromeView>
    </Pressable>
    </View>
  );
};

export const TextInputView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: TextInputLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const value = draftCtx?.draft?.kind === 'text' ? draftCtx.draft.value : '';
  const placeholder = layer.placeholder
    ? resolveLocalizedText(layer.placeholder, ctx.locale)
    : '';
  const dark = ctx.theme === 'dark';
  const mode = layer.inputType ?? 'plain';
  const multiline = mode === 'multiline';
  const keyboardType =
    mode === 'email'
      ? 'email-address'
      : mode === 'phone'
        ? 'phone-pad'
        : mode === 'url'
          ? 'url'
          : 'default';
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const inputPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  return (
    <ChromeView
      style={{
        flexDirection: 'column',
        gap: 8,
        ...inputPair.style,
      }}
      linearGradient={inputPair.linearGradient}
    >
      {layer.children?.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
      <TextInput
        editable={ctx.interactive}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#71717a' : '#a1a1aa'}
        maxLength={layer.maxLength}
        value={value}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={mode === 'email' ? 'none' : 'sentences'}
        secureTextEntry={layer.classification === 'sensitive' && !multiline}
        onChangeText={(next) =>
          draftCtx?.setDraft(next === '' ? null : { kind: 'text', value: next })
        }
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          fontSize: scaleAuthoredFontSize(14, ctx.fontScale ?? 1),
          minHeight: multiline ? 96 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
          backgroundColor: dark ? '#18181b' : '#fafafa',
          color: dark ? '#fafafa' : '#0a0a0a',
          borderWidth: 1,
          borderColor: dark ? '#27272a' : '#e4e4e7',
        }}
      />
    </ChromeView>
  );
};

export const ScaleInputView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: ScaleInputLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const step = layer.step ?? 1;
  const value =
    draftCtx?.draft?.kind === 'scale'
      ? draftCtx.draft.value
      : snapScaleValue(layer, layer.defaultValue ?? layer.min);
  const minLab = layer.minLabel ? resolveLocalizedText(layer.minLabel, ctx.locale) : String(layer.min);
  const maxLab = layer.maxLabel ? resolveLocalizedText(layer.maxLabel, ctx.locale) : String(layer.max);
  const slider = resolveScaleInputSliderForRender(layer, ctx.manifest.theme, ctx.theme);
  const fontScale = ctx.fontScale ?? 1;
  const toTextStyle = (text: typeof slider.label) => {
    const fontFamily = resolveNativeTextFontFamilyName(ctx.branding, text.fontFamily, text.fontWeight);
    const fontSize = scaleAuthoredFontSize(text.fontSizePx, fontScale) ?? text.fontSizePx;
    return {
      fontFamily,
      fontSize,
      fontWeight: text.fontWeight
        ? (String(text.fontWeight) as '400' | '600' | '700')
        : undefined,
      color: text.color,
      opacity: text.opacity,
      textAlign: text.textAlign,
      lineHeight:
        text.lineHeight !== undefined ? text.lineHeight * fontSize : undefined,
    };
  };
  const labelTextStyle = toTextStyle(slider.label);
  const valueTextStyle = toTextStyle(slider.value);
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const scalePair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const scaleAlignToCrossAxis = (
    align: typeof slider.value.textAlign,
  ): ViewStyle['alignItems'] => {
    if (align === 'left') return 'flex-start';
    if (align === 'right') return 'flex-end';
    return 'center';
  };
  return (
    <ChromeView
      style={{
        flexDirection: 'column',
        gap: 8,
        ...scalePair.style,
        alignItems: scaleAlignToCrossAxis(slider.value.textAlign),
      }}
      linearGradient={scalePair.linearGradient}
    >
      {layer.children?.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
      {slider.showLabels ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
          }}
        >
          <Text style={labelTextStyle}>{minLab}</Text>
          <Text style={labelTextStyle}>{maxLab}</Text>
        </View>
      ) : null}
      <Slider
        disabled={!ctx.interactive}
        minimumValue={layer.min}
        maximumValue={layer.max}
        step={step}
        value={value}
        minimumTrackTintColor={slider.fillColor}
        maximumTrackTintColor={slider.trackColor}
        thumbTintColor={slider.thumbColor}
        style={{ width: '100%', height: slider.thumbSizePx }}
        onValueChange={(v) =>
          draftCtx?.setDraft({ kind: 'scale', value: snapScaleValue(layer, v) })
        }
      />
      {slider.showValue ? (
        <Text style={[valueTextStyle, { alignSelf: 'stretch' }]}>{value}</Text>
      ) : null}
    </ChromeView>
  );
};
