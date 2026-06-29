import { createElement, type ComponentType, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildAuthCanvasManifest } from '@rheo/seeds';
import type { EmailPasswordAuthLayer } from '@getrheo/contracts';
import { EmailPasswordAuthProvider } from '../../../emailPasswordAuth';
import { EmailPasswordAuthView } from './EmailPasswordAuthView';
import { ChoicePressable, type Ctx, type RenderLayer } from '../../LayerRendererShared';

type ReactTestRenderer = {
  root: {
    findAllByType: (type: string | ComponentType) => Array<{ props: Record<string, unknown> }>;
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
    TextInput: passthrough('TextInput'),
    ActivityIndicator: passthrough('ActivityIndicator'),
    StyleSheet: { hairlineWidth: 1 },
  };
});

const authManifest = () => buildAuthCanvasManifest('00000000-0000-0000-0000-00000000a001');

const emailLayer = (): EmailPasswordAuthLayer => {
  const screen = authManifest().screens.find((s) => s.id === 'scr_auth_signin')!;
  const body = screen.regions.body;
  if (!body || body.kind !== 'stack') throw new Error('sign-in body missing');
  const layer = body.children.find((c) => c.kind === 'email_password_auth');
  if (!layer || layer.kind !== 'email_password_auth') throw new Error('email layer missing');
  return layer;
};

const smokeCtx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: authManifest(),
  screen: authManifest().screens.find((s) => s.id === 'scr_auth_signin')!,
  locale: 'en',
  interactive: true,
  theme: 'dark',
  ...overrides,
});

const noopRender: RenderLayer = () => null;

describe('EmailPasswordAuthView smoke', () => {
  it('renders TextInput fields for email and password slots', async () => {
    const layer = emailLayer();
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(EmailPasswordAuthProvider, {
          respond: () => undefined,
          children: createElement(EmailPasswordAuthView, {
            layer,
            ctx: smokeCtx(),
            renderLayer: noopRender,
          }),
        }),
      );
    });
    const inputs = tree!.root.findAllByType('TextInput');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    tree?.unmount();
  });

  it('shows error text when submit is pressed with empty password', async () => {
    const layer = emailLayer();
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(EmailPasswordAuthProvider, {
          respond: () => undefined,
          children: createElement(EmailPasswordAuthView, {
            layer,
            ctx: smokeCtx(),
            renderLayer: noopRender,
          }),
        }),
      );
    });
    const submit = tree!.root.findAllByType(ChoicePressable as ComponentType).at(-1);
    if (!submit) throw new Error('expected submit ChoicePressable');
    await act(async () => {
      (submit.props.onPress as () => void)();
    });
    const text = tree!.root.findAllByType('Text').map((n) => String(n.props.children ?? '')).join(' ');
    expect(text).toMatch(/password|email|required/i);
    tree?.unmount();
  });

  it('calls respond when validation passes and submit is pressed', async () => {
    const respond = vi.fn();
    const layer = emailLayer();
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(EmailPasswordAuthProvider, {
          respond,
          children: createElement(EmailPasswordAuthView, {
            layer,
            ctx: smokeCtx(),
            renderLayer: noopRender,
          }),
        }),
      );
    });
    await act(async () => {
      const inputs = tree!.root.findAllByType('TextInput');
      (inputs[0]?.props as { onChangeText?: (v: string) => void }).onChangeText?.('user@example.com');
      (inputs[1]?.props as { onChangeText?: (v: string) => void }).onChangeText?.('password123');
    });
    await act(async () => {
      const submit = tree!.root.findAllByType(ChoicePressable as ComponentType).at(-1);
      if (!submit) throw new Error('expected submit ChoicePressable');
      (submit.props.onPress as () => void)();
    });
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'email_password_auth_resolve',
        layerId: layer.id,
        success: true,
      }),
    );
    tree?.unmount();
  });
});
