import { createElement, type ComponentType, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildAuthCanvasManifest } from '@rheo/seeds';
import { oauthPresetEffectiveLabel } from '@getrheo/contracts';
import type { OAuthLoginLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX } from '@getrheo/flow-runtime';
import { OAuthLoginProvider } from '../../../oauthLogin';
import { OAuthLoginView } from './OAuthLoginView';
import { ChoicePressable, type Ctx, type RenderLayer } from '../../LayerRendererShared';

type TestNode = { props: Record<string, unknown> };
type ReactTestRenderer = {
  root: {
    findAllByType: (type: string | ComponentType) => Array<{ props: Record<string, unknown> }>;
    findAllByProps: (props: Record<string, unknown>) => Array<{ props: Record<string, unknown> }>;
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
    ActivityIndicator: passthrough('ActivityIndicator'),
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
      hairlineWidth: 1,
    },
  };
});

vi.mock('react-native-vector-icons/Ionicons', () => ({
  default: () => createElement('Ionicons'),
}));

const authManifest = () => buildAuthCanvasManifest('00000000-0000-0000-0000-00000000a001');

const oauthLayer = (): OAuthLoginLayer => {
  const screen = authManifest().screens.find((s) => s.id === 'scr_auth_oauth')!;
  const body = screen.regions.body;
  if (!body || body.kind !== 'stack') throw new Error('oauth body missing');
  const layer = body.children.find((c) => c.kind === 'oauth_login');
  if (!layer || layer.kind !== 'oauth_login') throw new Error('oauth layer missing');
  return layer;
};

const smokeCtx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: authManifest(),
  screen: authManifest().screens.find((s) => s.id === 'scr_auth_oauth')!,
  locale: 'en',
  interactive: true,
  theme: 'light',
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

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
};

describe('OAuthLoginView smoke', () => {
  it('renders preset row labels', async () => {
    const layer = oauthLayer();
    const presetChild = layer.children.find(
      (c) => c.kind === 'oauth_provider' && c.variant === 'preset' && c.provider === 'google',
    );
    if (!presetChild || presetChild.kind !== 'oauth_provider' || presetChild.variant !== 'preset') {
      throw new Error('google preset missing');
    }
    const label = oauthPresetEffectiveLabel(presetChild.provider, presetChild.label).default;
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(OAuthLoginProvider, {
          respond: () => undefined,
          children: createElement(OAuthLoginView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
        }),
      );
    });
    const text = tree!.root.findAllByType('Text').map((n) => String(n.props.children ?? '')).join(' ');
    expect(text).toContain(label);
    tree?.unmount();
  });

  it('left-aligns preset rows when oauth_login align is omitted', async () => {
    const layer = oauthLayer();
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(OAuthLoginProvider, {
          respond: () => undefined,
          children: createElement(OAuthLoginView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
        }),
      );
    });
    const first = tree!.root.findAllByType(ChoicePressable as ComponentType)[0];
    if (!first) throw new Error('expected ChoicePressable');
    expect(flattenStyle(first.props.style).alignSelf).toBe('flex-start');
    tree?.unmount();
  });

  it('dispatches tap through provider respond', async () => {
    const respond = vi.fn();
    const layer = oauthLayer();
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(OAuthLoginProvider, {
          respond,
          children: createElement(OAuthLoginView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
        }),
      );
    });
    const first = tree!.root.findAllByType(ChoicePressable as ComponentType)[0];
    if (!first) throw new Error('expected ChoicePressable');
    await act(async () => {
      (first.props.onPress as () => void)();
    });
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'oauth_login_resolve', layerId: layer.id }),
    );
    tree?.unmount();
  });
});

describe('OAuthLoginView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer wrap when oauth_login layer style uses a brand gradient', async () => {
    const layer: OAuthLoginLayer = {
      ...oauthLayer(),
      style: { background: brandGradientToken, radius: 12, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(OAuthLoginProvider, {
          respond: () => undefined,
          children: createElement(OAuthLoginView, {
            layer,
            ctx: smokeCtx({ branding: brandGradientBranding, parentStackDirection: 'vertical' }),
            renderLayer: noopRender,
          }),
        }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
