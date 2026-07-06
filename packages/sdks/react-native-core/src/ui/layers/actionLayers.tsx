import { Fragment } from 'react';
import { Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { BackButtonLayer, ButtonLayer } from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import { isEligibleConsumedDraft, type ConsumedDraftPayload } from '@getrheo/flow-runtime/stateMachine';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  findInputLayer,
  resolveAndInterpolateLocalizedText,
  resolveButtonLayoutAtWidth,
  resolveButtonStyleAtWidth,
  resolveLayerGap,
  resolveTextStyleAtWidth,
  resolveThemedBackground,
} from '@getrheo/flow-runtime';
import { buttonPaletteBorderFallback } from '@getrheo/flow-runtime/buttonVariantChrome';
import {
  useScreenInputDraft,
  useScreenInputValidity,
} from '@getrheo/flow-ui-state/draft';
import {
  useCheckboxContinueBlocked,
  useScreenCheckboxAck,
} from '@getrheo/flow-ui-state';
import { ChromeView, GradientUnderlay, type Ctx, type RenderLayer } from '../LayerRendererShared';
import { useMediaPlayback } from '../mediaPlayback';
import {
  alignFor,
  buttonChromeLayoutStyle,
  buttonPalette,
  commonViewStylePair,
  justifyFor,
  mergeButtonInlineLabelStyle,
  stripFlowAxesForFlexChild,
  stripCommonLayoutForInner,
  widthFor,
  wrapperLayoutViewStyle,
} from '../styles';

const ButtonTextChild = ({
  child,
  ctx,
  w,
  palette,
  btnResolved,
}: {
  child: Extract<ButtonLayer['children'][number], { kind: 'text' }>;
  ctx: Ctx;
  w: number;
  palette: ReturnType<typeof buttonPalette>;
  btnResolved: ReturnType<typeof resolveButtonStyleAtWidth>;
}) => {
  const childResolved = resolveTextStyleAtWidth(child.style, child.styleBreakpoints, w);
  const merged = mergeButtonInlineLabelStyle(
    palette,
    btnResolved,
    childResolved,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
    ctx.fontScale,
  );
  const textPair = commonViewStylePair(
    stripCommonLayoutForInner(childResolved),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const display = ctx.interpolationContext
    ? resolveAndInterpolateLocalizedText(child.text, {
        manifest: ctx.manifest,
        locale: ctx.locale,
        responses: ctx.interpolationContext.responses,
        customProperties: ctx.interpolationContext.customProperties,
      })
    : resolveLocalizedText(child.text, ctx.locale);
  return (
    <ChromeView
      style={{
        ...wrapperLayoutViewStyle(childResolved),
        ...textPair.style,
        ...(childResolved?.position !== 'absolute'
          ? { width: widthFor(childResolved?.width) }
          : {}),
      }}
      linearGradient={textPair.linearGradient}
    >
      <Text style={merged}>{display}</Text>
    </ChromeView>
  );
};

export const ButtonView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: ButtonLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const validity = useScreenInputValidity();
  const checkboxAck = useScreenCheckboxAck();
  const checkboxGate = useCheckboxContinueBlocked();
  const isContinue = layer.action.kind === 'continue';
  const isGoBack = layer.action.kind === 'go_back_one_screen';
  const canGoBack = ctx.interpolationContext?.canGoBack === true;
  const fallbackId =
    isGoBack && layer.action.kind === 'go_back_one_screen' ? layer.action.fallbackScreenId : undefined;
  const hasGoBackFallback = !!fallbackId;
  const mediaPlayback = useMediaPlayback();
  const isNone = layer.action.kind === 'none';
  const disabled =
    isNone ||
    !ctx.interactive ||
    (isContinue && !validity.valid) ||
    (isContinue && checkboxGate) ||
    (isGoBack && !canGoBack && !hasGoBackFallback);

  const pressed = useSharedValue(0);
  const palette = buttonPalette(layer.variant, ctx.theme);

  const handlePress = (): void => {
    if (disabled) return;
    if (layer.action.kind === 'request_app_review') {
      const drafted = draftCtx?.toResponse() ?? null;
      const capturedDraft: ConsumedDraftPayload | undefined =
        drafted && isEligibleConsumedDraft(drafted) ? drafted : undefined;
      const snap = checkboxAck?.snapshotValues() ?? {};
      ctx.onAction?.(layer.action, {
        layerId: layer.id,
        screenCommit: { checkboxValues: snap, capturedDraft },
      });
      return;
    }
    ctx.onAction?.(layer.action, { layerId: layer.id });
    if (layer.action.kind === 'play_media') {
      mediaPlayback?.playMedia(layer.action.targetLayerIds);
      return;
    }
    if (layer.action.kind === 'none') return;
    if (layer.action.kind === 'continue') {
      const drafted = draftCtx?.toResponse() ?? null;
      const primary =
        drafted ?? (findInputLayer(ctx.screen) ? null : { kind: 'cta', action: 'primary' as const });
      if (!primary) return;
      const snap = checkboxAck?.snapshotValues() ?? {};
      if (Object.keys(snap).length > 0) {
        ctx.onRespond?.({ kind: 'screen_commit', primary, checkboxValues: snap });
      } else {
        ctx.onRespond?.(primary);
      }
    } else if (layer.action.kind === 'skip') {
      ctx.onRespond?.({ kind: 'skip' });
    } else if (layer.action.kind === 'end_flow') {
      const drafted = draftCtx?.toResponse() ?? null;
      ctx.onRespond?.(
        drafted && isEligibleConsumedDraft(drafted)
          ? { kind: 'end_flow', consumedDraft: drafted }
          : { kind: 'end_flow' },
      );
    } else if (layer.action.kind === 'go_to_step') {
      ctx.onRespond?.({ kind: 'go_to_screen', screenId: layer.action.screenId });
    } else if (layer.action.kind === 'go_back_one_screen') {
      ctx.onRespond?.({
        kind: 'go_back',
        ...(layer.action.fallbackScreenId ? { fallbackScreenId: layer.action.fallbackScreenId } : {}),
      });
    }
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 80 });
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, { duration: 120 });
    })
    .onEnd(() => {
      pressed.value = 0;
      runOnJS(handlePress)();
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (disabled && ctx.interactive) {
      return {
        transform: [{ scale: 1 }],
        opacity: 0.5,
      };
    }
    return {
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
      opacity: interpolate(pressed.value, [0, 1], [1, 0.85]),
    };
  }, [disabled, ctx.interactive]);

  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const layout = resolveButtonLayoutAtWidth(layer, w);
  const btnResolved = resolveButtonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const isVertical = layout.direction === 'vertical';
  const btnPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(btnResolved, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const resolvedBg = resolveThemedBackground(
    ctx.manifest.theme,
    ctx.branding,
    ctx.theme,
    btnResolved?.background,
  );
  const borderFallback = buttonPaletteBorderFallback(
    layer.variant,
    ctx.theme,
    btnResolved,
    resolvedBg,
  );
  const hasAuthorBg =
    btnPair.linearGradient != null || btnPair.style.backgroundColor !== undefined;
  const containerStyle: ViewStyle = {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    ...(!hasAuthorBg ? { backgroundColor: palette.background } : {}),
    borderWidth: borderFallback.borderWidth,
    borderColor:
      borderFallback.borderColor ??
      (palette.border === 'transparent' ? undefined : palette.border),
    flexDirection: isVertical ? 'column' : 'row',
    gap: resolveLayerGap(layer.kind, layout.gap),
    alignItems: alignFor(layer.align) ?? 'center',
    justifyContent: justifyFor(layer.distribution) ?? 'center',
    ...buttonChromeLayoutStyle(btnResolved, ctx.parentStackDirection),
    ...btnPair.style,
  };
  const buttonChildCtx: Ctx = {
    ...ctx,
    isRegionRoot: false,
  };

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[
          containerStyle,
          animatedStyle,
          btnPair.linearGradient ? { overflow: 'hidden' } : {},
        ]}
      >
        {btnPair.linearGradient ? <GradientUnderlay spec={btnPair.linearGradient} /> : null}
        {layer.children.map((c) => {
          if (c.kind === 'text') {
            return (
              <ButtonTextChild
                key={c.id}
                child={c}
                ctx={ctx}
                w={w}
                palette={palette}
                btnResolved={btnResolved}
              />
            );
          }
          return <Fragment key={c.id}>{renderLayer(c, buttonChildCtx)}</Fragment>;
        })}
      </Animated.View>
    </GestureDetector>
  );
};

export const BackButtonView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: BackButtonLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const canGoBack = ctx.interpolationContext?.canGoBack === true;
  const hasFallback = !!layer.fallbackScreenId;
  const disabled = !ctx.interactive || (ctx.interactive && !canGoBack && !hasFallback);
  const pressed = useSharedValue(0);
  const palette = buttonPalette(layer.variant, ctx.theme);

  const handlePress = (): void => {
    if (disabled) return;
    ctx.onRespond?.({
      kind: 'go_back',
      ...(layer.fallbackScreenId ? { fallbackScreenId: layer.fallbackScreenId } : {}),
    });
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 80 });
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, { duration: 120 });
    })
    .onEnd(() => {
      pressed.value = 0;
      runOnJS(handlePress)();
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (disabled && ctx.interactive) {
      return {
        transform: [{ scale: 1 }],
        opacity: 0.5,
      };
    }
    return {
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
      opacity: interpolate(pressed.value, [0, 1], [1, 0.85]),
    };
  }, [disabled, ctx.interactive]);

  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const layout = resolveButtonLayoutAtWidth(layer, w);
  const btnResolved = resolveButtonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const isVertical = layout.direction === 'vertical';
  const btnPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(btnResolved, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const resolvedBg = resolveThemedBackground(
    ctx.manifest.theme,
    ctx.branding,
    ctx.theme,
    btnResolved?.background,
  );
  const borderFallback = buttonPaletteBorderFallback(
    layer.variant,
    ctx.theme,
    btnResolved,
    resolvedBg,
  );
  const hasAuthorBg =
    btnPair.linearGradient != null || btnPair.style.backgroundColor !== undefined;
  const containerStyle: ViewStyle = {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    ...(!hasAuthorBg ? { backgroundColor: palette.background } : {}),
    borderWidth: borderFallback.borderWidth,
    borderColor:
      borderFallback.borderColor ??
      (palette.border === 'transparent' ? undefined : palette.border),
    flexDirection: isVertical ? 'column' : 'row',
    gap: resolveLayerGap(layer.kind, layout.gap),
    alignItems: alignFor(layer.align) ?? 'center',
    justifyContent: justifyFor(layer.distribution) ?? 'center',
    ...buttonChromeLayoutStyle(btnResolved, ctx.parentStackDirection),
    ...btnPair.style,
  };
  const buttonChildCtx: Ctx = {
    ...ctx,
    isRegionRoot: false,
  };

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[
          containerStyle,
          animatedStyle,
          btnPair.linearGradient ? { overflow: 'hidden' } : {},
        ]}
      >
        {btnPair.linearGradient ? <GradientUnderlay spec={btnPair.linearGradient} /> : null}
        {layer.children.map((c) => {
          if (c.kind === 'text') {
            return (
              <ButtonTextChild
                key={c.id}
                child={c}
                ctx={ctx}
                w={w}
                palette={palette}
                btnResolved={btnResolved}
              />
            );
          }
          return <Fragment key={c.id}>{renderLayer(c, buttonChildCtx)}</Fragment>;
        })}
      </Animated.View>
    </GestureDetector>
  );
};
