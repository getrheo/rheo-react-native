import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { CounterLayer, LoaderLayer, ProgressLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX, formatCounterLayerDisplay } from '@getrheo/flow-runtime';
import { CounterView, LoaderView, ProgressView } from './feedbackLayers';
import type { Ctx } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown>; children?: TestNode[] };
type ReactTestRenderer = {
  root: {
    findAllByType: (type: string) => TestNode[];
    findByProps: (props: Record<string, unknown>) => TestNode;
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
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    },
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

const brandGradientPreset: BrandGradient = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'G1',
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#ff0000', offset: 0 },
    { color: '#0000ff', offset: 1 },
  ],
};

const brandGradientBranding: Branding = {
  gradientPresets: [brandGradientPreset],
  colorPresets: [],
  fontFamilies: [],
};

const brandGradientToken = `${BRAND_GRADIENT_PREFIX}${brandGradientPreset.id}`;

const gradientCtx = (screenId: string): Ctx =>
  smokeCtx(screenId, { branding: brandGradientBranding, parentStackDirection: 'vertical' });

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
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

describe('CounterView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: CounterLayer = {
      id: 'lyr_ctr_gradient',
      kind: 'counter',
      startValue: 0,
      endValue: 10,
      style: { background: brandGradientToken, radius: 8, fontSize: 24 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(CounterView, { layer, ctx: gradientCtx('scr_sm_counter') }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('ProgressView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: ProgressLayer = {
      id: 'lyr_prog_gradient',
      kind: 'progress',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ProgressView, { layer, ctx: gradientCtx('scr_sm_progress') }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('LoaderView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: LoaderLayer = {
      id: 'lyr_ld_gradient',
      kind: 'loader',
      variant: 'linear',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LoaderView, { layer, ctx: gradientCtx('scr_sm_loader_linear') }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
