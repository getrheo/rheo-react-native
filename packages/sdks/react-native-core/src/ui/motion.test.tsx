import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationClip, RestingMotionEntry, Screen } from '@getrheo/contracts';

type ReactTestRenderer = {
  root: {
    findAllByType: (type: string) => Array<{ props: Record<string, unknown> }>;
  };
  unmount: () => void;
};
type RtrModule = {
  create: (element: ReactNode) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const reanimatedMock = vi.hoisted(() => ({
  cancelAnimation: vi.fn(),
  withTiming: vi.fn((value: number) => value),
}));

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      View: (props: { children?: ReactNode }) =>
        React.createElement('Animated.View', props, props.children),
    },
    Easing: { linear: 'linear' },
    cancelAnimation: reanimatedMock.cancelAnimation,
    useAnimatedStyle: (fn: () => unknown) => ({ __animatedStyle: fn }),
    useSharedValue: (value: number) => ({ value }),
    withTiming: reanimatedMock.withTiming,
  };
});

const mountClip: AnimationClip = {
  id: 'clip_mount',
  targetLayerId: 'lyr_target',
  trigger: 'mount',
  durationMs: 400,
  tracks: [
    {
      property: 'opacity',
      keyframes: [
        { t: 0, value: 0 },
        { t: 1, value: 1 },
      ],
    },
  ],
};

const restingEntry: RestingMotionEntry = {
  id: 'rest_translate',
  preset: 'translate',
  durationMs: 100,
  timelineStartMs: 0,
  translatePeakXPx: 12,
  translatePeakYPx: 0,
};

const makeScreen = (animations: AnimationClip[]): Screen => ({
  id: 'scr_motion',
  name: 'Motion',
  next: { default: null },
  animations,
  regions: {
    body: { id: 'lyr_body', kind: 'stack', direction: 'vertical', children: [] },
  },
});

const renderShell = async ({
  animations = [mountClip],
  restingMotionEntries = [],
}: {
  animations?: AnimationClip[];
  restingMotionEntries?: RestingMotionEntry[];
}) => {
  const { LayerMotionShell, MotionProvider } = await import('./motion');
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(
      createElement(
        MotionProvider,
        {
          screen: makeScreen(animations),
          children: createElement(LayerMotionShell, {
            layerId: 'lyr_target',
            restingMotionEntries,
            children: createElement('LayerChild', { id: 'child' }),
          }),
        },
      ),
    );
  });
  if (!tree) throw new Error('LayerMotionShell test renderer did not mount');
  return tree;
};

describe('LayerMotionShell', () => {
  beforeEach(() => {
    reanimatedMock.cancelAnimation.mockClear();
    reanimatedMock.withTiming.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('wraps layers with clips in Animated.View and starts the screen timeline', async () => {
    const tree = await renderShell({ animations: [mountClip] });
    expect(tree.root.findAllByType('Animated.View').length).toBeGreaterThan(0);
    expect(reanimatedMock.withTiming).toHaveBeenCalled();
  });

  it('returns children without animated wrappers when there are no clips or resting entries', async () => {
    const tree = await renderShell({ animations: [], restingMotionEntries: [] });
    expect(tree.root.findAllByType('Animated.View')).toHaveLength(0);
  });

  it('wraps resting motion in an additional Animated.View', async () => {
    vi.useFakeTimers();
    const tree = await renderShell({ animations: [], restingMotionEntries: [restingEntry] });
    expect(tree.root.findAllByType('Animated.View').length).toBeGreaterThan(0);
  });
});
