import { Fragment } from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import type {
  NumberStepperButtonLayer,
  NumberStepperLayer,
} from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveCommonStyleAtWidth,
  resolveLayerGap,
  resolveTextStyleAtWidth,
} from '@getrheo/flow-runtime';
import {
  defaultNumberStepperValue,
  numberStepperParts,
  stepNumberStepperValue,
} from '@getrheo/flow-runtime/numberStepperValidation';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  alignFor,
  commonViewStylePair,
  justifyFor,
  layoutHeightFor,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  textContainerViewStylePair,
  textLayerStyle,
  widthFor,
} from '../styles';

export const NumberStepperView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: NumberStepperLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const value =
    draftCtx?.draft?.kind === 'number_stepper'
      ? draftCtx.draft.value
      : defaultNumberStepperValue(layer);
  const atMin = value <= layer.min;
  const atMax = value >= layer.max;
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const gap = resolveLayerGap(layer.kind, layer.gap);
  const axis = layer.direction ?? 'horizontal';
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const outerPair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const { decrement, increment, value: valueLayer } = numberStepperParts(layer);
  const unitLabel = valueLayer?.unitLabel
    ? resolveLocalizedText(valueLayer.unitLabel, ctx.locale)
    : undefined;
  const valueResolved = valueLayer
    ? resolveTextStyleAtWidth(valueLayer.style, valueLayer.styleBreakpoints, w)
    : undefined;
  const valueTextStyle = textLayerStyle(valueResolved, ctx.manifest.theme, ctx.theme, {
    branding: ctx.branding,
    fontScale: ctx.fontScale,
  });
  const valueChrome = valueResolved
    ? textContainerViewStylePair(
        stripCommonLayoutForInner(
          stripFlowAxesForFlexChild(valueResolved, axis),
        ),
        ctx.manifest.theme,
        ctx.theme,
        ctx.branding,
      )
    : null;
  const defaultButtonBg =
    ctx.theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)';

  const renderButton = (
    button: NumberStepperButtonLayer | undefined,
    direction: 1 | -1,
    disabled: boolean,
    accessibilityLabel: string,
  ) => {
    if (!button) return null;
    const btnResolved = resolveCommonStyleAtWidth(button.style, button.styleBreakpoints, w);
    const btnPair = commonViewStylePair(
      stripFlowAxesForFlexChild(btnResolved, axis),
      ctx.manifest.theme,
      ctx.theme,
      ctx.branding,
    );
    const hasContentChildren = (button.children?.length ?? 0) > 0;
    const onPress = () => {
      if (!ctx.interactive || disabled) return;
      draftCtx?.setDraft({
        kind: 'number_stepper',
        value: stepNumberStepperValue(layer, value, direction),
      });
    };
    const buttonBoxStyle: ViewStyle = {
      flexShrink: 0,
      width: widthFor(btnResolved?.width) ?? 36,
      height: layoutHeightFor(btnResolved?.height) ?? 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: defaultButtonBg,
      ...btnPair.style,
      opacity: disabled ? 0.4 : 1,
    };
    return (
      <Pressable
        key={button.id}
        onPress={onPress}
        disabled={!ctx.interactive || disabled}
        accessibilityLabel={accessibilityLabel}
        style={buttonBoxStyle}
      >
        {hasContentChildren
          ? button.children!.map((c) => (
              <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
            ))
          : (
              <Text style={{ fontSize: 20, textAlign: 'center', color: valueTextStyle.color }}>
                {direction < 0 ? '-' : '+'}
              </Text>
            )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: axis === 'vertical' ? 'column' : 'row',
        alignItems: layer.align ? alignFor(layer.align) : 'center',
        justifyContent: layer.distribution ? justifyFor(layer.distribution) : undefined,
        gap,
        ...outerPair.style,
      }}
    >
      {renderButton(decrement, -1, atMin, 'Decrease')}
      {valueLayer ? (
        <ChromeView
          key={valueLayer.id}
          style={{
            flex: 1,
            minWidth: axis === 'horizontal' ? 0 : undefined,
            minHeight: axis === 'vertical' ? 0 : undefined,
            alignItems: 'center',
            justifyContent: 'center',
            ...(valueChrome?.style ?? {}),
          }}
          linearGradient={valueChrome?.linearGradient ?? null}
        >
          <Text style={{ ...valueTextStyle, textAlign: 'center', width: '100%' }}>
            {String(value)}
            {unitLabel ? ` ${unitLabel}` : ''}
          </Text>
        </ChromeView>
      ) : (
        <View style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ textAlign: 'center' }}>{String(value)}</Text>
        </View>
      )}
      {renderButton(increment, 1, atMax, 'Increase')}
    </View>
  );
};
