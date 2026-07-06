import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildStressHarnessManifest } from '@rheo/seeds';
import type { ButtonLayer, Screen } from '@getrheo/contracts';
import { ScreenInputDraftProvider } from '@getrheo/flow-ui-state/draft';
import { ButtonView } from './actionLayers';
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
      View: (props: { children?: ReactNode; style?: unknown }) =>
        React.createElement('Animated.View', props, props.children),
    },
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    useSharedValue: (v: number) => ({ value: v }),
    withTiming: (v: unknown) => v,
    runOnJS: (fn: () => void) => fn,
    interpolate: () => 1,
    Easing: { inOut: () => 'inOut' },
  };
});

vi.mock('@getrheo/flow-ui-state', () => ({
  useScreenCheckboxAck: () => null,
  useCheckboxContinueBlocked: () => false,
}));

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
};

const findContinueButton = (screen: Screen): ButtonLayer => {
  const body = screen.regions.body;
  if (!body || body.kind !== 'stack') throw new Error('expected stack body');
  const btn = body.children.find((c) => c.kind === 'button' && c.action.kind === 'continue');
  if (!btn || btn.kind !== 'button') throw new Error('continue button missing');
  return btn;
};

const ctxFor = (manifest: ReturnType<typeof buildStressHarnessManifest>, screen: Screen): Ctx => ({
  manifest,
  screen,
  locale: 'en',
  interactive: true,
  theme: 'dark',
});

describe('ButtonView manual-submit continue gating', () => {
  it('disables continue until single_choice draft is set', async () => {
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_tier');
    if (!screen) throw new Error('scr_sh_tier missing');
    const layer = findContinueButton(screen);
    const noopRender: RenderLayer = () => null;

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScreenInputDraftProvider, {
          screen: screen as Screen,
          children: createElement(ButtonView, {
            layer,
            ctx: ctxFor(manifest, screen as Screen),
            renderLayer: noopRender,
          }),
        }),
      );
    });

    const animated = tree!.root.findAllByType('Animated.View')[0];
    const style = animated?.props.style;
    const flat = flattenStyle(style);
    expect(flat.opacity).toBe(0.5);
    tree?.unmount();
  });

  it('disables continue until multiple_choice minSelections is met', async () => {
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_multi');
    if (!screen) throw new Error('scr_sh_multi missing');
    const layer = findContinueButton(screen);
    const noopRender: RenderLayer = () => null;

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScreenInputDraftProvider, {
          screen: screen as Screen,
          children: createElement(ButtonView, {
            layer,
            ctx: ctxFor(manifest, screen as Screen),
            renderLayer: noopRender,
          }),
        }),
      );
    });

    const animated = tree!.root.findAllByType('Animated.View')[0];
    const style = animated?.props.style;
    const flat = flattenStyle(style);
    expect(flat.opacity).toBe(0.5);
    tree?.unmount();
  });

  it('disables continue until required text_input is valid', async () => {
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_email');
    if (!screen) throw new Error('scr_sh_email missing');
    const layer = findContinueButton(screen);
    const noopRender: RenderLayer = () => null;

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScreenInputDraftProvider, {
          screen: screen as Screen,
          children: createElement(ButtonView, {
            layer,
            ctx: ctxFor(manifest, screen as Screen),
            renderLayer: noopRender,
          }),
        }),
      );
    });

    const animated = tree!.root.findAllByType('Animated.View')[0];
    const flat = flattenStyle(animated?.props.style);
    expect(flat.opacity).toBe(0.5);
    tree?.unmount();
  });

  it('enables continue when scale_input has an initial default draft', async () => {
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_scale');
    if (!screen) throw new Error('scr_sh_scale missing');
    const layer = findContinueButton(screen);
    const noopRender: RenderLayer = () => null;

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScreenInputDraftProvider, {
          screen: screen as Screen,
          children: createElement(ButtonView, {
            layer,
            ctx: ctxFor(manifest, screen as Screen),
            renderLayer: noopRender,
          }),
        }),
      );
    });

    const animated = tree!.root.findAllByType('Animated.View')[0];
    const flat = flattenStyle(animated?.props.style);
    expect(flat.opacity).toBe(1);
    tree?.unmount();
  });
});
