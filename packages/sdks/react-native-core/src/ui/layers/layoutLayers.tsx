import { Fragment } from 'react';
import {
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import type { HyperlinkLayer, Layer, StackLayer, TextLayer } from '@getrheo/contracts';
import { layerHasAbsolutePositionAuthored, layerSubtreeContainsAbsolutePosition, resolveLocalizedText } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveAndInterpolateLocalizedText,
  resolveCommonStyleAtWidth,
  resolveHyperlinkPreviewLabel,
  resolveLayerGap,
  resolveStackLayoutAtWidth,
  resolveTextStyleAtWidth,
  stackMainAxisFillHeight,
} from '@getrheo/flow-runtime';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  alignFor,
  commonViewStylePair,
  justifyFor,
  paddingStyle,
  parentAlignUsesCrossAxisStretch,
  stripFlowAxesForFlexChild,
  stripCommonLayoutForInner,
  textContainerViewStylePair,
  textLayerStyle,
  widthFor,
} from '../styles';

const resolvedLayerZIndex = (layer: Layer, viewportW: number): number => {
  if (!('style' in layer)) return 0;
  const resolved = resolveCommonStyleAtWidth(
    layer.style,
    'styleBreakpoints' in layer ? layer.styleBreakpoints : undefined,
    viewportW,
  );
  return resolved?.zIndex ?? 0;
};

const stripPaddingFromCommonStyle = (
  style: ReturnType<typeof stripCommonLayoutForInner>,
): ReturnType<typeof stripCommonLayoutForInner> => {
  if (!style) return undefined;
  const { padding: _padding, ...rest } = style;
  return Object.keys(rest).length ? rest : undefined;
};

export const StackView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: StackLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const layout = resolveStackLayoutAtWidth(layer, w);
  const isVertical = layout.direction === 'vertical';
  const justifyContent =
    justifyFor(layer.distribution) ??
    (layer.justify
      ? justifyFor(layer.justify as 'start' | 'center' | 'end')
      : undefined);
  const isRoot = ctx.isRegionRoot === true;
  const resolvedStyle = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const stripped = stripCommonLayoutForInner(
    stripFlowAxesForFlexChild(resolvedStyle, ctx.parentStackDirection),
  );
  const subtreeAbs = layerSubtreeContainsAbsolutePosition(layer);
  const flowWidth =
    resolvedStyle?.position === 'absolute'
      ? undefined
      : ctx.parentStackDirection === undefined
        ? (widthFor(resolvedStyle?.width) ?? '100%')
        : undefined;
  const childCtx: Ctx = {
    ...ctx,
    isRegionRoot: false,
    regionKind: undefined,
    parentStackDirection: layout.direction,
    parentStackAlign: layer.align,
  };
  const rootFillsRegionHeight = isRoot && ctx.regionKind === 'body';
  const inParentStack = ctx.parentStackDirection !== undefined;
  const crossStretch = parentAlignUsesCrossAxisStretch(ctx.parentStackAlign);
  const containerStyle = subtreeAbs
    ? stripPaddingFromCommonStyle(stripped)
    : stripped;
  const pair = commonViewStylePair(containerStyle, ctx.manifest.theme, ctx.theme, ctx.branding);
  // The stack-as-flex-child size block (Option A: nested stacks fill the parent
  // main axis unconditionally). Applied once, on the outer ChromeView.
  const sizeStyle: ViewStyle = {
    ...(flowWidth !== undefined ? { width: flowWidth } : {}),
    ...(rootFillsRegionHeight
      ? { flex: 1, minHeight: 0, width: '100%', alignSelf: 'stretch' }
      : inParentStack
        ? {
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            ...(ctx.parentStackDirection === 'vertical' ? { width: '100%' } : {}),
            ...(crossStretch ? { alignSelf: 'stretch' as const } : {}),
          }
        : isRoot
          ? { alignSelf: 'stretch' }
          : {}),
  };
  const flowLayoutStyle: ViewStyle = {
    flexDirection: isVertical ? 'column' : 'row',
    gap: resolveLayerGap('stack', layout.gap),
    alignItems: alignFor(layer.align),
    justifyContent,
    flexWrap: layer.wrap ? 'wrap' : undefined,
  };
  const outerStyle: ViewStyle = {
    ...pair.style,
    ...(subtreeAbs
      ? { overflow: 'visible', position: 'relative', ...sizeStyle }
      : { ...flowLayoutStyle, ...sizeStyle }),
  };
  const flowChildren = layer.children.filter((c) => !layerHasAbsolutePositionAuthored(c));
  const absoluteChildren = layer.children
    .filter(layerHasAbsolutePositionAuthored)
    .sort((a, b) => resolvedLayerZIndex(a, w) - resolvedLayerZIndex(b, w));

  if (subtreeAbs) {
    const outerGrows = sizeStyle.flex != null;
    const flowFillsMainAxis = stackMainAxisFillHeight(resolvedStyle?.height);
    return (
      <ChromeView style={outerStyle} linearGradient={pair.linearGradient}>
        <View
          style={{
            position: 'relative',
            width: '100%',
            ...(outerGrows ? { flex: 1, minHeight: 0 } : {}),
          }}
        >
          <View
            style={{
              ...flowLayoutStyle,
              width: '100%',
              ...(flowFillsMainAxis || isVertical ? { height: '100%', minHeight: 0 } : {}),
              ...paddingStyle(resolvedStyle?.padding),
              zIndex: 0,
            }}
          >
            {flowChildren.map((c) => (
              <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
            ))}
          </View>
          {absoluteChildren.map((c) => (
            <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
          ))}
        </View>
      </ChromeView>
    );
  }

  return (
    <ChromeView style={outerStyle} linearGradient={pair.linearGradient}>
      {layer.children.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
    </ChromeView>
  );
};

export const TextView = ({ layer, ctx }: { layer: TextLayer; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveTextStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const textPair = textContainerViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(resolvedStyle, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const wrapStyle: ViewStyle = {
    ...textPair.style,
    ...(resolvedStyle?.position !== 'absolute' && ctx.parentStackDirection === undefined
      ? { width: widthFor(resolvedStyle?.width) }
      : {}),
  };
  const display = ctx.interpolationContext
    ? resolveAndInterpolateLocalizedText(layer.text, {
        manifest: ctx.manifest,
        locale: ctx.locale,
        responses: ctx.interpolationContext.responses,
        customProperties: ctx.interpolationContext.customProperties,
      })
    : resolveLocalizedText(layer.text, ctx.locale);
  return (
    <ChromeView style={wrapStyle} linearGradient={textPair.linearGradient}>
      <Text
        style={textLayerStyle(resolvedStyle, ctx.manifest.theme, ctx.theme, {
          inheritDocumentForeground: true,
          branding: ctx.branding,
        })}
      >
        {display}
      </Text>
    </ChromeView>
  );
};

export const HyperlinkView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: HyperlinkLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const outerPair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const wrapStyle: ViewStyle = {
    ...outerPair.style,
    ...(resolvedOuter?.position !== 'absolute' && ctx.parentStackDirection === undefined
      ? { width: widthFor(resolvedOuter?.width) }
      : {}),
  };
  const href = layer.href.trim();
  const isVertical = (layer.direction ?? 'horizontal') === 'vertical';
  const open = (): void => {
    if (!ctx.interactive) return;
    void Linking.openURL(href)
      .then(() => ctx.onHyperlinkOpened?.({ layerId: layer.id, href }))
      .catch(() => {});
  };
  const inner: ViewStyle = {
    flexDirection: isVertical ? 'column' : 'row',
    gap: resolveLayerGap('hyperlink', layer.gap),
    alignItems: alignFor(layer.align),
    justifyContent: justifyFor(layer.distribution),
    flexWrap: layer.wrap ? 'wrap' : 'nowrap',
  };
  const previewLabel = resolveHyperlinkPreviewLabel(layer.children, {
    manifest: ctx.manifest,
    locale: ctx.locale,
    interpolationContext: ctx.interpolationContext,
  });
  return (
    <ChromeView style={wrapStyle} linearGradient={outerPair.linearGradient}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={previewLabel || href}
        onPress={open}
        disabled={!ctx.interactive}
        style={inner}
      >
        {layer.children.map((c) => (
          <Fragment key={c.id}>
            {renderLayer(c, {
              ...ctx,
              parentStackDirection: isVertical ? 'vertical' : 'horizontal',
            })}
          </Fragment>
        ))}
      </Pressable>
    </ChromeView>
  );
};
