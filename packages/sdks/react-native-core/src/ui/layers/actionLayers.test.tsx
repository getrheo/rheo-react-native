import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { BackButtonLayer, ButtonLayer } from '@getrheo/contracts';
import { BackButtonView, ButtonView } from './actionLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown> };
type ReactTestRenderer = {
  root: {
    findAllByProps: (props: Record<string, unknown>) => TestNode[];
    findAllByType: (type: string) => TestNode[];
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

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: ReactNode }) =>
    React.createElement(name, props, props.children);
  return {
    Text: passthrough('Text'),
    View: passthrough('View'),
  };
});

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
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({ value: v }),
    withTiming: (v: unknown) => v,
    runOnJS: (fn: () => void) => fn,
    interpolate: () => 1,
    Easing: { inOut: () => 'inOut' },
  };
});

vi.mock('@getrheo/flow-ui-state/draft', () => ({
  useScreenInputDraft: () => null,
  useScreenInputValidity: () => ({ valid: false }),
}));

vi.mock('@getrheo/flow-ui-state', () => ({
  useScreenCheckboxAck: () => null,
  useCheckboxContinueBlocked: () => false,
}));

const smokeCtx = (screenId: string, overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen(screenId),
  locale: 'en',
  interactive: false,
  theme: 'dark',
  ...overrides,
});

const noopRender: RenderLayer = () => null;

const findLayer = <T extends { id: string }>(screenId: string, layerId: string): T => {
  const body = layerSmokeScreen(screenId).regions.body;
  if (!body || body.kind !== 'stack') throw new Error('expected stack body');
  const layer = body.children.find((c) => c.id === layerId);
  if (!layer) throw new Error(`layer ${layerId} missing`);
  return layer as unknown as T;
};

describe('native actionLayers smoke', () => {
  it('ButtonView primary continue renders label text', async () => {
    const layer = findLayer<ButtonLayer>('scr_sm_button', 'lyr_sm_btn_primary');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ButtonView, { layer, ctx: smokeCtx('scr_sm_button'), renderLayer: noopRender }),
      );
    });
    const text = tree!.root
      .findAllByType('Text')
      .map((n: TestNode) => String(n.props.children ?? ''))
      .join('');
    expect(text).toContain('Continue');
    expect(tree!.root.findAllByType('GestureDetector').length).toBeGreaterThan(0);
    tree?.unmount();
  });

  it('ButtonView sizes to content height when width is full', async () => {
    const layer = findLayer<ButtonLayer>('scr_sm_button', 'lyr_sm_btn_primary');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ButtonView, {
          layer,
          ctx: { ...smokeCtx('scr_sm_button'), parentStackDirection: 'vertical' },
          renderLayer: noopRender,
        }),
      );
    });
    const animated = tree!.root.findAllByType('Animated.View');
    const style = animated[0]?.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat?.width).toBe('100%');
    expect(flat?.height).toBeUndefined();
    tree?.unmount();
  });

  it('ButtonView lowers opacity when sim-disabled', async () => {
    const layer = findLayer<ButtonLayer>('scr_sm_button', 'lyr_sm_btn_primary');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ButtonView, {
          layer,
          ctx: smokeCtx('scr_sm_button', { interactive: true }),
          renderLayer: noopRender,
        }),
      );
    });
    const animated = tree!.root.findAllByType('Animated.View');
    const style = animated[0]?.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat?.opacity).toBe(0.5);
    tree?.unmount();
  });

  it('BackButtonView renders gesture chrome', async () => {
    const layer = findLayer<BackButtonLayer>('scr_sm_button', 'lyr_sm_back');
    const renderLayer: RenderLayer = (child) =>
      createElement('Text', { key: child.id }, child.kind);
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(BackButtonView, {
          layer,
          ctx: smokeCtx('scr_sm_button'),
          renderLayer,
        }),
      );
    });
    expect(tree!.root.findAllByType('GestureDetector').length).toBeGreaterThan(0);
    tree?.unmount();
  });

  it('ButtonView skips variant border when background is transparent', async () => {
    const layer: ButtonLayer = {
      id: 'lyr_alert_deny',
      kind: 'button',
      variant: 'secondary',
      action: { kind: 'continue' },
      direction: 'horizontal',
      align: 'center',
      distribution: 'center',
      style: {
        width: 'full',
        background: 'transparent',
        padding: { t: 12, r: 12, b: 12, l: 12 },
      },
      children: [
        {
          id: 'lyr_alert_deny_lbl',
          kind: 'text',
          text: { default: "Don't Allow" },
          style: { fontSize: 15, fontWeight: 600, color: '#007AFF' },
        },
      ],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ButtonView, { layer, ctx: smokeCtx('scr_sm_button'), renderLayer: noopRender }),
      );
    });
    const animated = tree!.root.findAllByType('Animated.View');
    const style = animated[0]?.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat?.borderWidth).toBe(0);
    tree?.unmount();
  });
});
