import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { MultipleChoiceLayer, SingleChoiceLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX } from '@getrheo/flow-runtime';
import { MultipleChoiceView, SingleChoiceView } from './choiceLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown> };
type ReactTestRenderer = {
  root: { findAllByType: (type: string) => TestNode[] };
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

vi.mock('@getrheo/flow-ui-state/draft', () => ({
  useScreenInputDraft: () => null,
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

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      View: (props: { children?: ReactNode }) =>
        React.createElement('Animated.View', props, props.children),
      createAnimatedComponent: (c: unknown) => c,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({ value: v }),
    withTiming: (v: unknown) => v,
    interpolate: () => 1,
    runOnJS: (fn: () => void) => fn,
    Easing: { inOut: () => 'inOut' },
    cancelAnimation: () => undefined,
    useAnimatedProps: () => ({}),
    useAnimatedReaction: () => undefined,
    createAnimatedComponent: (c: unknown) => c,
  };
});

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
  };
});

const smokeCtx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen('scr_sm_1'),
  locale: 'en',
  interactive: false,
  theme: 'dark',
  parentStackDirection: 'vertical',
  ...overrides,
});

const noopRender: RenderLayer = () => null;

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

const gradientCtx = (): Ctx =>
  smokeCtx({ branding: brandGradientBranding, parentStackDirection: 'vertical' });

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
};

describe('SingleChoiceView choice grid layout', () => {
  it('wraps grid options in measured-width tile shells', async () => {
    const layer: SingleChoiceLayer = {
      id: 'lyr_sc_grid',
      kind: 'single_choice',
      fieldKey: 'pick',
      direction: 'grid',
      columns: 2,
      gap: 8,
      branching: { enabled: false, conditions: [] },
      children: [
        {
          id: 'lyr_sc_grid_opt_a',
          kind: 'stack',
          direction: 'vertical',
          children: [
            { id: 'lyr_sc_grid_opt_a_t', kind: 'text', text: { default: 'G-A' }, style: { fontSize: 14 } },
          ],
        },
        {
          id: 'lyr_sc_grid_opt_b',
          kind: 'stack',
          direction: 'vertical',
          children: [
            { id: 'lyr_sc_grid_opt_b_t', kind: 'text', text: { default: 'G-B' }, style: { fontSize: 14 } },
          ],
        },
      ],
      optionBindings: [
        { optionId: 'a', rootLayerId: 'lyr_sc_grid_opt_a' },
        { optionId: 'b', rootLayerId: 'lyr_sc_grid_opt_b' },
      ],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(SingleChoiceView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const views = tree!.root.findAllByType('View');
    const gridShell = views.find((node) => {
      const style = flattenStyle(node.props.style);
      return style.flexWrap === 'wrap' && style.flexDirection === 'row' && style.gap === 8;
    });
    expect(gridShell).toBeDefined();
    const tileShells = views.filter((node) => {
      const style = flattenStyle(node.props.style);
      return style.flexGrow === 0 && style.flexShrink === 0 && style.flexBasis === '50.0000%';
    });
    expect(tileShells.length).toBe(2);
    tree?.unmount();
  });
});

describe('SingleChoiceView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: SingleChoiceLayer = {
      id: 'lyr_sc_gradient',
      kind: 'single_choice',
      fieldKey: 'pick',
      branching: { enabled: false, conditions: [] },
      style: { background: brandGradientToken, radius: 12, width: 'full' },
      children: [
        {
          id: 'lyr_sc_gradient_opt_a',
          kind: 'stack',
          direction: 'horizontal',
          align: 'center',
          gap: 8,
          children: [
            {
              id: 'lyr_sc_gradient_opt_a_t',
              kind: 'text',
              text: { default: 'A' },
              style: { fontSize: 14 },
            },
          ],
        },
      ],
      optionBindings: [{ optionId: 'a', rootLayerId: 'lyr_sc_gradient_opt_a' }],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(SingleChoiceView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('MultipleChoiceView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: MultipleChoiceLayer = {
      id: 'lyr_mc_gradient',
      kind: 'multiple_choice',
      fieldKey: 'tags',
      branching: { enabled: false, conditions: [] },
      style: { background: brandGradientToken, radius: 12, width: 'full' },
      children: [
        {
          id: 'lyr_mc_gradient_opt_a',
          kind: 'stack',
          direction: 'horizontal',
          align: 'center',
          gap: 8,
          children: [
            {
              id: 'lyr_mc_gradient_opt_a_t',
              kind: 'text',
              text: { default: 'A' },
              style: { fontSize: 14 },
            },
          ],
        },
      ],
      optionBindings: [{ optionId: 'a', rootLayerId: 'lyr_mc_gradient_opt_a' }],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(MultipleChoiceView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
