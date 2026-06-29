import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { CounterLayer, FlowManifest, LoaderLayer, ProgressLayer } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  findManualSubmitInputLayer,
  formatCounterLayerDisplay,
  multiplyColorAlpha,
  resolveCounterAnimationDurationMs,
  resolveLoaderCircularSizePx,
  resolveLoaderLinearHeightPx,
  resolveLoaderStrokeWidthPx,
  resolveProgressLinearHeightPx,
  resolveTextStyleAtWidth,
  resolveThemedColor,
} from '@getrheo/flow-runtime';
import { ChromeView, type Ctx } from '../LayerRendererShared';
import {
  commonViewStylePair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  textContainerViewStylePair,
  textLayerStyle,
} from '../styles';

const flowProgressRatio = (manifest: FlowManifest, screenId: string): number => {
  const n = manifest.screens.length;
  if (n === 0) return 0;
  const i = manifest.screens.findIndex((s) => s.id === screenId);
  const step = i >= 0 ? i + 1 : 1;
  return Math.min(1, Math.max(0, step / n));
};

export const ProgressView = ({ layer, ctx }: { layer: ProgressLayer; ctx: Ctx }) => {
  const ratio = flowProgressRatio(ctx.manifest, ctx.screen.id);
  // Bar height: authored via `style.height` (px); resolver supplies the
  // per-kind default for sparse manifests.
  const h = resolveProgressLinearHeightPx(layer.style?.height);
  const track =
    (resolveThemedColor(ctx.manifest.theme, ctx.theme, layer.trackColor) as string | undefined) ??
    (ctx.theme === 'dark' ? '#3f3f46' : '#e4e4e7');
  const fillResolved = resolveThemedColor(ctx.manifest.theme, ctx.theme, layer.fillColor);
  const fillFromTheme = ctx.manifest.theme?.primary
    ? (resolveThemedColor(ctx.manifest.theme, ctx.theme, ctx.manifest.theme.primary) as string | undefined)
    : undefined;
  const fill =
    (fillResolved as string | undefined) ??
    fillFromTheme ??
    (ctx.theme === 'dark' ? '#fafafa' : '#0a0a0a');
  const progPair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(layer.style, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  return (
    <ChromeView style={progPair.style} linearGradient={progPair.linearGradient}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        style={{
          height: h,
          borderRadius: Math.max(2, h / 2),
          backgroundColor: track,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: fill }} />
      </View>
    </ChromeView>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const loaderAlignItems: Record<NonNullable<LoaderLayer['align']>, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

export const LoaderView = ({ layer, ctx }: { layer: LoaderLayer; ctx: Ctx }) => {
  const frozenPreview = !ctx.interactive;
  const targetPct = layer.targetPercent ?? 100;
  const durationMs = layer.durationMs ?? 2000;
  const fillDelayMs = layer.fillDelayMs ?? 0;
  const variant = layer.variant ?? 'linear';
  const screenRef = useRef(ctx.screen);
  screenRef.current = ctx.screen;

  const trackBase =
    (resolveThemedColor(ctx.manifest.theme, ctx.theme, layer.trackColor) as string | undefined) ??
    (ctx.theme === 'dark' ? '#3f3f46' : '#e4e4e7');
  const track = multiplyColorAlpha(trackBase, layer.trackOpacity) ?? trackBase;
  const fillResolved = resolveThemedColor(ctx.manifest.theme, ctx.theme, layer.fillColor);
  const fillFromTheme = ctx.manifest.theme?.primary
    ? (resolveThemedColor(ctx.manifest.theme, ctx.theme, ctx.manifest.theme.primary) as string | undefined)
    : undefined;
  const fillColor =
    (fillResolved as string | undefined) ??
    fillFromTheme ??
    (ctx.theme === 'dark' ? '#fafafa' : '#0a0a0a');

  const onRespondRef = useRef(ctx.onRespond);
  onRespondRef.current = ctx.onRespond;
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const completedRef = useRef(false);

  const fireComplete = useCallback((): void => {
    if (completedRef.current) return;
    completedRef.current = true;
    const screen = screenRef.current;
    if (findManualSubmitInputLayer(screen) != null) {
      return;
    }
    const oc = layerRef.current.onComplete ?? { mode: 'none' as const };
    if (oc.mode === 'next') onRespondRef.current?.({ kind: 'cta', action: 'primary' });
    else if (oc.mode === 'screen') onRespondRef.current?.({ kind: 'go_to_screen', screenId: oc.screenId });
  }, []);

  const anim = useSharedValue(frozenPreview ? 1 : 0);
  const ocMode = layer.onComplete?.mode ?? 'none';

  useEffect(() => {
    completedRef.current = false;
    cancelAnimation(anim);
    if (frozenPreview) {
      anim.value = 1;
      return;
    }
    anim.value = 0;
    const shouldFire = ocMode !== 'none';
    anim.value = withDelay(
      fillDelayMs,
      withTiming(1, { duration: Math.max(0, durationMs), easing: Easing.linear }, (finished) => {
        if (!finished || !shouldFire) return;
        runOnJS(fireComplete)();
      }),
    );
  }, [
    frozenPreview,
    durationMs,
    fillDelayMs,
    layer.id,
    ctx.screen.id,
    ocMode,
    targetPct,
    variant,
    fireComplete,
  ]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${anim.value * targetPct}%`,
  }));

  // Circular size = `style.width` (validated equal to `style.height`); ring
  // thickness = `style.strokeWidth`. Linear bar height = `style.height`.
  // Resolvers supply the per-kind defaults when the manifest omits a value.
  const size = resolveLoaderCircularSizePx(layer.style?.width);
  const strokeW = resolveLoaderStrokeWidthPx(layer.style?.strokeWidth);
  const r = Math.max(1, (size - strokeW) / 2);
  const circ = 2 * Math.PI * r;

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - anim.value * (targetPct / 100)),
  }));

  const h = resolveLoaderLinearHeightPx(layer.style?.height);
  const loaderPair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(layer.style, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const outerWrap: ViewStyle = {
    ...loaderPair.style,
    alignItems: loaderAlignItems[layer.align ?? 'start'],
  };

  if (variant === 'circular') {
    return (
      <ChromeView style={outerWrap} linearGradient={loaderPair.linearGradient}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={track}
            strokeWidth={strokeW}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            animatedProps={animatedCircleProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </ChromeView>
    );
  }

  return (
    <ChromeView style={outerWrap} linearGradient={loaderPair.linearGradient}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: targetPct,
        }}
        style={{
          width: '100%',
          alignSelf: 'stretch',
          height: h,
          borderRadius: Math.max(2, h / 2),
          backgroundColor: track,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ width: '100%', height: '100%', backgroundColor: fillColor }, fillStyle]}
        />
      </View>
    </ChromeView>
  );
};

export const CounterView = ({ layer, ctx }: { layer: CounterLayer; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveTextStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const counterPair = textContainerViewStylePair(
    stripFlowAxesForFlexChild(resolvedStyle, ctx.parentStackDirection) as typeof resolvedStyle,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const wrapStyle: ViewStyle = counterPair.style;
  const startVal = layer.startValue;
  const endVal = layer.endValue;
  const delayMs = layer.delayMs ?? 0;
  const decimalPlaces = layer.decimalPlaces ?? 0;
  const displayKind = layer.displayKind ?? 'number';
  const timeFormat = layer.timeFormat ?? 'mm_ss';
  const durationMs = resolveCounterAnimationDurationMs({
    displayKind,
    durationMs: layer.durationMs,
    startValue: layer.startValue,
    endValue: layer.endValue,
  });

  const dispOpts = useMemo(
    () => ({ displayKind, decimalPlaces, timeFormat }),
    [displayKind, decimalPlaces, timeFormat],
  );

  const frozenPreview = !ctx.interactive;

  const pushFormattedDisplay = useCallback(
    (v: number) => {
      setDisplay(formatCounterLayerDisplay(v, dispOpts));
    },
    [dispOpts],
  );

  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(() => {
    if (frozenPreview) return formatCounterLayerDisplay(startVal, dispOpts);
    const instant = durationMs <= 0 || startVal === endVal;
    if (instant && delayMs <= 0) {
      return formatCounterLayerDisplay(endVal, dispOpts);
    }
    return formatCounterLayerDisplay(startVal, dispOpts);
  });

  useEffect(() => {
    cancelAnimation(progress);
    if (frozenPreview) {
      progress.value = 0;
      setDisplay(formatCounterLayerDisplay(startVal, dispOpts));
      return;
    }

    const instant = durationMs <= 0 || startVal === endVal;

    if (instant) {
      progress.value = 0;
      setDisplay(formatCounterLayerDisplay(startVal, dispOpts));
      if (delayMs <= 0) {
        progress.value = 1;
        setDisplay(formatCounterLayerDisplay(endVal, dispOpts));
        return;
      }
      const id = setTimeout(() => {
        progress.value = 1;
        setDisplay(formatCounterLayerDisplay(endVal, dispOpts));
      }, delayMs);
      return () => {
        clearTimeout(id);
        cancelAnimation(progress);
      };
    }

    progress.value = 0;
    setDisplay(formatCounterLayerDisplay(startVal, dispOpts));
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: durationMs, easing: Easing.linear }),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [delayMs, dispOpts, durationMs, endVal, frozenPreview, progress, startVal]);

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      runOnJS(pushFormattedDisplay)(startVal + (endVal - startVal) * p);
    },
    [endVal, pushFormattedDisplay, startVal],
  );

  return (
    <ChromeView style={wrapStyle} linearGradient={counterPair.linearGradient}>
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
