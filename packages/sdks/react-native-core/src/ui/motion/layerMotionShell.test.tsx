import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { wrapperLayoutViewStyle } from '../styles';
import type { LayerMotionShellProps } from './types';

vi.mock('react-native-reanimated', () => {
  const Animated = {
    View: (props: { style?: unknown; children?: ReactNode }) =>
      createElement('Animated.View', props, props.children),
    createAnimatedComponent: <T,>(Comp: T): T => Comp,
  };
  return {
    default: Animated,
    createAnimatedComponent: <T,>(Comp: T): T => Comp,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: (value: number) => ({ value }),
    withTiming: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    cancelAnimation: () => undefined,
    Easing: { bezier: () => 'bezier', inOut: () => undefined, ease: undefined, linear: 'linear' },
  };
});

vi.mock('./provider', () => ({
  useController: () => null,
}));

vi.mock('./layerResting', () => ({
  LayerRestingInner: (props: { children?: unknown }) => props.children ?? null,
}));

describe('LayerMotionShell layoutStyle', () => {
  it('applies z-index and absolute inset on the outer wrapper', async () => {
    const { LayerMotionShell } = await import('./layerMotionShell');
    const layoutStyle = wrapperLayoutViewStyle({
      position: 'absolute',
      inset: { t: 4, l: 8 },
      zIndex: 3,
      width: '1/2',
    });
    const el = createElement(LayerMotionShell, {
      layerId: 'lyr_test',
      restingMotionEntries: [],
      layoutStyle,
      children: createElement(Text, null, 'child'),
    });
    expect((el.props as LayerMotionShellProps).layoutStyle).toMatchObject({
      position: 'absolute',
      top: 4,
      left: 8,
      zIndex: 3,
      width: '50%',
    });
  });
});
