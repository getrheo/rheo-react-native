import { useEffect } from 'react';
import type {ReactNode} from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  layerRestingMotionStartMs,
  restingMotionBounceAmplitudePx,
  restingMotionCycleDurationMs,
  restingMotionEffectiveDurationMs,
  restingMotionPulseMinOpacity,
  restingMotionRotateMaxDeg,
  restingMotionRotateSign,
  restingMotionRotateSpringBack,
  restingMotionScaleAtPhase,
  restingMotionScalePatternDurationMs,
  restingMotionTranslatePeakResolved,
  restingMotionTranslateSpringBack,
} from '@getrheo/flow-runtime';
import type { RestingMotion, Screen } from '@getrheo/contracts';
import { useController } from './provider';

type LayerRestingInnerProps = {
  cfg: RestingMotion;
  screen: Screen;
  layerId: string;
  children: ReactNode;
};

export const LayerRestingInner = ({
  cfg,
  screen,
  layerId,
  children,
}: LayerRestingInnerProps) => {
  const ctrl = useController();
  const restingPhase = useSharedValue(0);
  const restingReady = useSharedValue(0);
  const bounceAmpPx = cfg.preset === 'bounce' ? restingMotionBounceAmplitudePx(cfg) : 0;

  useEffect(() => {
    cancelAnimation(restingPhase);
    restingPhase.value = 0;
    restingReady.value = 0;
    if (!ctrl) return;

    const startMs = layerRestingMotionStartMs(screen, layerId, cfg);
    const segmentMs = restingMotionEffectiveDurationMs(cfg);
    const cycleMs = restingMotionCycleDurationMs(cfg);
    const loop = cfg.loop === true;

    let segmentStop: ReturnType<typeof setTimeout> | undefined;

    const tid = setTimeout(() => {
      restingReady.value = 1;

      const armSegmentStop = (): void => {
        segmentStop = setTimeout(() => {
          cancelAnimation(restingPhase);
          restingReady.value = 0;
        }, segmentMs);
      };

      if (loop) {
        if (cfg.preset === 'bounce') {
          restingPhase.value = withRepeat(
            withTiming(1, { duration: Math.max(1, cycleMs), easing: Easing.linear }),
            -1,
            false,
          );
        } else {
          const repeatMs =
            cfg.preset === 'scale' ? restingMotionScalePatternDurationMs(cfg) : cycleMs;
          restingPhase.value = withRepeat(
            withTiming(1, {
              duration: Math.max(1, repeatMs),
              easing: Easing.inOut(Easing.quad),
            }),
            -1,
            false,
          );
        }
        armSegmentStop();
      } else if (cfg.preset === 'bounce') {
        restingPhase.value = withTiming(1, {
          duration: Math.max(1, segmentMs),
          easing: Easing.linear,
        });
        segmentStop = setTimeout(() => {
          restingReady.value = 0;
        }, segmentMs);
      } else if (cfg.preset === 'scale') {
        const patternMs = restingMotionScalePatternDurationMs(cfg);
        restingPhase.value = withTiming(1, {
          duration: Math.max(1, patternMs),
          easing: Easing.inOut(Easing.quad),
        });
        armSegmentStop();
      } else {
        restingPhase.value = withTiming(1, {
          duration: Math.max(1, segmentMs),
          easing: Easing.inOut(Easing.quad),
        });
        segmentStop = setTimeout(() => {
          restingReady.value = 0;
        }, segmentMs);
      }
    }, startMs);

    return () => {
      clearTimeout(tid);
      if (segmentStop) clearTimeout(segmentStop);
      cancelAnimation(restingPhase);
    };
  }, [
    screen,
    layerId,
    cfg.preset,
    cfg.durationMs,
    cfg.cycleDurationMs,
    cfg.loop,
    cfg.intensity,
    cfg.bounceAmplitudePx,
    cfg.scaleDirection,
    cfg.scalePercent,
    cfg.scalePatternDurationMs,
    cfg.scaleSpringBack,
    cfg.scaleUpPercent,
    cfg.scaleDownPercent,
    cfg.translateRangePx,
    cfg.translatePeakXPx,
    cfg.translatePeakYPx,
    cfg.translatePeakXPercent,
    cfg.translatePeakYPercent,
    cfg.translateSpringBack,
    cfg.rotateMaxDeg,
    cfg.rotateDirection,
    cfg.rotateSpringBack,
    cfg.pulseMinOpacity,
    cfg.delayMsAfterMountEnd,
    cfg.timelineStartMs,
    ctrl,
    restingPhase,
    restingReady,
  ]);

  const restingStyle = useAnimatedStyle(() => {
    'worklet';
    if (restingReady.value < 1) return {};

    const ph = restingPhase.value;

    switch (cfg.preset) {
      case 'translate': {
        const peak = restingMotionTranslatePeakResolved(cfg);
        const env = restingMotionTranslateSpringBack(cfg) ? Math.sin(ph * Math.PI) : ph;
        let tx = env * peak.x;
        let ty = env * peak.y;
        if (Math.abs(tx) < 1e-6) tx = 0;
        if (Math.abs(ty) < 1e-6) ty = 0;
        if (peak.unit === 'percent') {
          return {
            transform: [{ translateX: `${tx}%` }, { translateY: `${ty}%` }],
          };
        }
        return { transform: [{ translateX: tx }, { translateY: ty }] };
      }
      case 'bounce':
        return { transform: [{ translateY: -bounceAmpPx * Math.sin(Math.PI * ph) }] };
      case 'scale': {
        const sc = restingMotionScaleAtPhase(cfg, ph);
        return { transform: [{ scale: sc }] };
      }
      case 'pulse': {
        const omin = restingMotionPulseMinOpacity(cfg);
        const dip = 1 - omin;
        const op = ph <= 0.5 ? 1 - ph * 2 * dip : 1 - (1 - ph) * 2 * dip;
        return { opacity: op };
      }
      case 'rotate': {
        const peakDeg = restingMotionRotateMaxDeg(cfg);
        let deg =
          restingMotionRotateSign(cfg) *
          (restingMotionRotateSpringBack(cfg)
            ? Math.sin(ph * Math.PI) * peakDeg
            : ph * peakDeg);
        if (Math.abs(deg) < 1e-6) deg = 0;
        return { transform: [{ rotateZ: `${deg}deg` }] };
      }
      default:
        return {};
    }
  });

  return <Animated.View style={restingStyle}>{children}</Animated.View>;
};
