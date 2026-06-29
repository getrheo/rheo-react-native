import { useMemo } from 'react';
import type {ReactNode} from 'react';
import { View } from 'react-native';
import type {ViewStyle} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type {LayerMotionShellProps} from './types';
import { useController } from './provider';
import { LayerRestingInner } from './layerResting';
import {
  animationClipsToWorkletPayload,
  layerHasClipsWorklet,
  sampleLayerClipsAtWorklet,
  staggerStepMsFromScreen,
} from './samplingWorklet';

const hasLayoutStyle = (layoutStyle: ViewStyle | undefined): boolean =>
  layoutStyle != null && Object.keys(layoutStyle).length > 0;

/** Keep authored `rotate` on an outer View so clip/resting transforms do not overwrite it. */
const splitAuthoredRotateFromLayout = (
  layout: ViewStyle | undefined,
): { layout: ViewStyle | undefined; rotateStyle: ViewStyle | undefined } => {
  if (!layout?.transform || !Array.isArray(layout.transform)) {
    return { layout, rotateStyle: undefined };
  }
  const rotateIdx = layout.transform.findIndex((t) => t != null && 'rotate' in t);
  if (rotateIdx < 0) return { layout, rotateStyle: undefined };
  const rotateEntry = layout.transform[rotateIdx];
  const rest = layout.transform.filter((_, i) => i !== rotateIdx);
  const nextLayout: ViewStyle = { ...layout };
  if (rest.length > 0) nextLayout.transform = rest;
  else delete nextLayout.transform;
  const hasLayoutKeys = Object.keys(nextLayout).length > 0;
  return {
    layout: hasLayoutKeys ? nextLayout : undefined,
    rotateStyle: { transform: [rotateEntry] },
  };
};

const wrapWithLayout = (layout: ViewStyle | undefined, inner: ReactNode): ReactNode => {
  if (!layout) return inner;
  return (
    <View style={layout} collapsable={false}>
      {inner}
    </View>
  );
};

const sampledToAnimatedStyle = (
  opacity: number | undefined,
  tx: number | undefined,
  ty: number | undefined,
  sc: number | undefined,
) => {
  'worklet';
  const transform = [
    tx !== undefined ? { translateX: tx } : null,
    ty !== undefined ? { translateY: ty } : null,
    sc !== undefined ? { scale: sc } : null,
  ].filter(Boolean) as Array<
    { translateX: number } | { translateY: number } | { scale: number }
  >;
  return {
    ...(opacity !== undefined ? { opacity } : {}),
    ...(transform.length > 0 ? { transform } : {}),
  };
};

export const LayerMotionShell = ({
  layerId,
  restingMotionEntries,
  layoutStyle,
  heightFill = false,
  children,
}: LayerMotionShellProps) => {
  const ctrl = useController();
  const clips = ctrl?.clipsByLayer.get(layerId);
  const hasClips = clips != null && clips.length > 0;
  const hasResting = restingMotionEntries.length > 0;
  const staggerStep = ctrl ? staggerStepMsFromScreen(ctrl.screen) : 60;

  const sortedClips = useMemo(() => {
    if (!clips) return [];
    return [...clips].sort((a, b) => {
      const staggerIdx = (c: typeof a) =>
        c.trigger === 'stagger' ? (c.staggerIndex ?? 0) * staggerStep : 0;
      const da = (a.delayMs ?? 0) + staggerIdx(a);
      const db = (b.delayMs ?? 0) + staggerIdx(b);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
  }, [clips, staggerStep]);

  const workletClips = useMemo(
    () => animationClipsToWorkletPayload(sortedClips),
    [sortedClips],
  );
  const timelineMs = ctrl?.timelineMs;

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (!timelineMs || !layerHasClipsWorklet(workletClips)) {
      return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] };
    }
    const sample = sampleLayerClipsAtWorklet(workletClips, staggerStep, timelineMs.value);
    const partial = sampledToAnimatedStyle(
      sample.opacity,
      sample.translateX,
      sample.translateY,
      sample.scale,
    );
    return {
      opacity: partial.opacity ?? 1,
      transform:
        partial.transform && partial.transform.length > 0
          ? partial.transform
          : [{ translateX: 0 }, { translateY: 0 }],
    };
  }, [workletClips, staggerStep, timelineMs]);

  const wrapResting = (inner: ReactNode) => {
    if (restingMotionEntries.length === 0 || !ctrl) {
      return inner;
    }
    return restingMotionEntries.reduceRight<ReactNode>((acc, entry) => {
      const { id: _rid, ...cfg } = entry;
      return (
        <LayerRestingInner key={entry.id} cfg={cfg} screen={ctrl.screen} layerId={layerId}>
          {acc}
        </LayerRestingInner>
      );
    }, inner);
  };

  let inner = wrapResting(children);
  if (heightFill) {
    inner = (
      <View style={{ flex: 1, minHeight: 0, width: '100%' }} collapsable={false}>
        {inner}
      </View>
    );
  }
  const { layout: motionLayout, rotateStyle } = splitAuthoredRotateFromLayout(
    hasLayoutStyle(layoutStyle) ? layoutStyle : undefined,
  );

  if (!hasClips && !hasResting) {
    return wrapWithLayout(rotateStyle, wrapWithLayout(motionLayout, inner));
  }

  const motionShell = (
    <Animated.View
      style={motionLayout ? [motionLayout, animatedStyle] : animatedStyle}
      collapsable={false}
    >
      {inner}
    </Animated.View>
  );

  return wrapWithLayout(rotateStyle, motionShell);
};
