import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { CounterLayer, LoaderLayer, ProgressLayer } from '@getrheo/contracts';
import { formatCounterLayerDisplay } from '@getrheo/flow-runtime';
import { CounterView, LoaderView, ProgressView } from './feedbackLayers';
import type { Ctx } from '../LayerRendererShared';

type ReactTestRenderer = {
  root: {
    findAllByType: (type: string) => Array<{ props: Record<string, unknown> }>;
    findByProps: (props: Record<string, unknown>) => { props: Record<string, unknown> };
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
  withTiming: vi.fn((value: number) => value),
  withDelay: vi.fn((_delayMs: number, value: number) => value),
}));

vi.mock('react-native-gesture-handler', async () => {
  const React = await import('react');
  return {
    Gesture: {
      Tap: () => ({
        enabled: () => ({
          onBegin: () => ({
            onFinalize: () => ({
              onEnd: () => ({}),
            }),
          }),
        }),
      }),
    },
    GestureDetector: (props: { children?: ReactNode }) =>
      React.createElement('GestureDetector', props, props.children),
  };
});

vi.mock('react-native-linear-gradient', () => ({
  default: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: ReactNode }) =>
    React.createElement(name, props, props.children);
  return {
    Text: passthrough('Text'),
    View: passthrough('View'),
    AccessibilityInfo: {
      addEventListener: () => ({ remove: () => undefined }),
      isReduceMotionEnabled: async () => false,
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      View: (props: { children?: ReactNode }) =>
        React.createElement('Animated.View', props, props.children),
      createAnimatedComponent: (Comp: unknown) => Comp,
    },
    Easing: { linear: 'linear' },
    cancelAnimation: vi.fn(),
    runOnJS: (fn: () => void) => fn,
    useAnimatedProps: () => ({}),
    useAnimatedReaction: () => undefined,
    useAnimatedStyle: (fn: () => unknown) => ({ __animatedStyle: fn }),
    useSharedValue: (value: number) => ({ value }),
    withDelay: reanimatedMock.withDelay,
    withTiming: reanimatedMock.withTiming,
    createAnimatedComponent: (Comp: unknown) => Comp,
  };
});

vi.mock('react-native-svg', async () => {
  const React = await import('react');
  return {
    default: (props: { children?: ReactNode }) => React.createElement('Svg', props, props.children),
    Circle: (props: Record<string, unknown>) => React.createElement('Circle', props),
  };
});

const smokeCtx = (screenId: string, overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen(screenId),
  locale: 'en',
  interactive: true,
  theme: 'dark',
  ...overrides,
});

const findLayer = <T extends { id: string }>(screenId: string, layerId: string): T => {
  const body = layerSmokeScreen(screenId).regions.body;
  if (!body || body.kind !== 'stack') throw new Error('expected stack body');
  const layer = body.children.find((c) => c.id === layerId);
  if (!layer) throw new Error(`layer ${layerId} missing`);
  return layer as unknown as T;
};

describe('native feedbackLayers smoke', () => {
  beforeEach(() => {
    reanimatedMock.withTiming.mockClear();
    reanimatedMock.withDelay.mockClear();
  });

  it('ProgressView exposes progressbar accessibilityValue', async () => {
    const layer = findLayer<ProgressLayer>('scr_sm_progress', 'lyr_sm_prog');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ProgressView, { layer, ctx: smokeCtx('scr_sm_progress') }),
      );
    });
    const bar = tree!.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(bar.props.accessibilityValue).toMatchObject({ now: 22 });
    tree?.unmount();
  });

  it('LoaderView linear starts at 0 and arms withTiming when interactive', async () => {
    const layer = findLayer<LoaderLayer>('scr_sm_loader_linear', 'lyr_sm_ld_lin');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LoaderView, { layer, ctx: smokeCtx('scr_sm_loader_linear', { interactive: true }) }),
      );
    });
    expect(reanimatedMock.withTiming).toHaveBeenCalled();
    expect(tree!.root.findAllByType('Animated.View').length).toBeGreaterThan(0);
    tree?.unmount();
  });

  it('LoaderView circular renders Svg Circle', async () => {
    const layer = findLayer<LoaderLayer>('scr_sm_loader_circ', 'lyr_sm_ld_circ');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LoaderView, { layer, ctx: smokeCtx('scr_sm_loader_circ') }),
      );
    });
    expect(tree!.root.findAllByType('Circle').length).toBeGreaterThan(0);
    tree?.unmount();
  });

  it('CounterView shows formatted time at t=0 in static preview', async () => {
    const layer = findLayer<CounterLayer>('scr_sm_counter', 'lyr_sm_ctr');
    const expected = formatCounterLayerDisplay(layer.startValue, {
      displayKind: layer.displayKind,
      decimalPlaces: layer.decimalPlaces,
      timeFormat: layer.timeFormat,
    });
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(CounterView, { layer, ctx: smokeCtx('scr_sm_counter', { interactive: false }) }),
      );
    });
    const textNodes = tree!.root.findAllByType('Text');
    const joined = textNodes.map((n) => String(n.props.children ?? '')).join('');
    expect(joined).toContain(expected);
    tree?.unmount();
  });
});
