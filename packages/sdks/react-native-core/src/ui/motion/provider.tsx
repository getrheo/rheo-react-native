import { createContext, useContext, useEffect, useMemo } from 'react';
import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  clipsByLayerId,
  screenAnimationsDurationMs,
  screenLoaderTimelineExtentMs,
} from '@getrheo/flow-runtime';
import type {ControllerValue, MotionProviderProps} from './types';

const MotionContext = createContext<ControllerValue | null>(null);

export const MotionProvider = ({ screen, children }: MotionProviderProps) => {
  const clipsByLayer = useMemo(() => clipsByLayerId(screen), [screen]);
  const durationMs = useMemo(
    () =>
      Math.max(screenAnimationsDurationMs(screen), screenLoaderTimelineExtentMs(screen)),
    [screen],
  );
  const timelineMs = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(timelineMs);
    timelineMs.value = 0;
    if (durationMs <= 0) {
      return;
    }
    timelineMs.value = withTiming(durationMs, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [screen.id, durationMs, timelineMs]);

  const value = useMemo<ControllerValue>(
    () => ({ screen, clipsByLayer, timelineMs, durationMs }),
    [screen, clipsByLayer, timelineMs, durationMs],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
};

export const useController = (): ControllerValue | null => useContext(MotionContext);
