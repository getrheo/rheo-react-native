import { createElement, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { IconLayer, ImageLayer, LottieLayer, VideoLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX, DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX, resolveImageStyleAtWidth } from '@getrheo/flow-runtime';
import { __setVideoAdapterForTests } from '../../platform/videoAdapter.js';
import type { VideoLayerViewProps } from '../../platform/videoAdapter.js';
import { ChromeView, type Ctx } from '../LayerRendererShared';
import { mediaLayerOuterLayoutPair } from '../styles';
import { IconView, ImageView, LottieLayerView, VideoLayerView } from './mediaLayers';

type ReactTestRenderer = {
  root: {
    findByType: (type: string) => { props: Record<string, unknown> };
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
    Image: passthrough('Image'),
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
      hairlineWidth: 1,
    },
  };
});

vi.mock('lottie-react-native', () => ({
  default: (props: Record<string, unknown>) => createElement('LottieView', props),
}));

const mockPlayerPlay = vi.fn();
const mockPlayerPause = vi.fn();

let mockPlayerIsPlaying = false;

vi.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    get playing() {
      return mockPlayerIsPlaying;
    },
    play: () => {
      mockPlayerPlay();
      mockPlayerIsPlaying = true;
    },
    pause: () => {
      mockPlayerPause();
      mockPlayerIsPlaying = false;
    },
    loop: false,
    muted: true,
    currentTime: 0,
    addListener: () => ({ remove: () => undefined }),
  }),
  VideoView: (props: Record<string, unknown>) => createElement('ExpoVideoView', props),
}));

vi.mock('react-native-vector-icons/Ionicons', () => ({
  default: (props: { name?: string }) => createElement('Ionicons', props),
}));

const smokeCtx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen('scr_sm_media'),
  locale: 'en',
  interactive: false,
  theme: 'dark',
  mediaMap: { 'asset-hero': 'https://example.com/hero.png' },
  ...overrides,
});

const findLayer = <T extends { id: string }>(layerId: string): T => {
  const body = layerSmokeScreen('scr_sm_media').regions.body;
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

const gradientCtx = (overrides?: Partial<Ctx>): Ctx =>
  smokeCtx({
    branding: brandGradientBranding,
    parentStackDirection: 'vertical',
    ...overrides,
  });

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
};

const StubVideoLayerView = ({ layer, ctx }: VideoLayerViewProps) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveImageStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
    resolvedStyle,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
    ctx.parentStackDirection,
  );
  return createElement(ChromeView, {
    style: outerStyle,
    linearGradient,
    children: createElement('View', null),
  });
};

describe('native mediaLayers smoke', () => {
  it('ImageView passes source uri and accessibilityLabel', async () => {
    const layer: ImageLayer = {
      ...findLayer<ImageLayer>('lyr_sm_img'),
      media: { mediaAssetId: 'asset-hero' },
      alt: 'Hero shot',
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(ImageView, { layer, ctx: smokeCtx() }));
    });
    const img = tree!.root.findByType('Image');
    expect(img.props.source).toEqual({ uri: 'https://example.com/hero.png' });
    expect(img.props.accessibilityLabel).toBe('Hero shot');
    tree?.unmount();
  });

  it('IconView resolves ionicons name', async () => {
    const layer = findLayer<IconLayer>('lyr_sm_icon_i');
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(IconView, { layer, ctx: smokeCtx() }));
    });
    const icon = tree!.root.findByType('Ionicons');
    expect(icon.props.name).toBe('star-outline');
    tree?.unmount();
  });

  it('LottieLayerView applies authored width=full and height=fill as 100%/100% when rendered without a parent stack', async () => {
    // After the flex-shell port, the inner chrome only owns width/height
    // when the parent stack direction is not set on the context. Stack
    // children get their flex behaviour from the outer shell that
    // LayerRenderer wraps around each layer.
    const layer: LottieLayer = {
      ...findLayer<LottieLayer>('lyr_sm_lottie'),
      style: { width: 'full', height: 'fill' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(LottieLayerView, { layer, ctx: smokeCtx() }));
    });
    const views = tree!.root.findAllByType('View');
    const flattenStyle = (style: unknown): ViewStyle | undefined => {
      if (style == null) return undefined;
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean)) as ViewStyle;
      }
      return style as ViewStyle;
    };
    const outer = views.find((v) => {
      const s = flattenStyle(v.props.style);
      return s?.width === '100%' && s?.height === '100%';
    });
    expect(outer).toBeTruthy();
    tree?.unmount();
  });

  it('LottieLayerView forwards source to lottie mock', async () => {
    const layer: LottieLayer = {
      ...findLayer<LottieLayer>('lyr_sm_lottie'),
      media: { mediaAssetId: 'asset-lottie' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LottieLayerView, {
          layer,
          ctx: smokeCtx({ mediaMap: { 'asset-lottie': 'https://example.com/anim.json' } }),
        }),
      );
    });
    const lottie = tree!.root.findByType('LottieView');
    expect(lottie.props.source).toEqual({ uri: 'https://example.com/anim.json' });
    tree?.unmount();
  });
});

describe('ImageView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: ImageLayer = {
      id: 'lyr_img_gradient',
      kind: 'image',
      style: { background: brandGradientToken, radius: 8, width: 80, height: 80 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(ImageView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('IconView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: IconLayer = {
      id: 'lyr_icon_gradient',
      kind: 'icon',
      family: 'ionicons',
      iconName: 'star-outline',
      style: { background: brandGradientToken, radius: 8, width: 32, height: 32 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(IconView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('LottieLayerView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: LottieLayer = {
      id: 'lyr_lottie_gradient',
      kind: 'lottie',
      loop: true,
      style: { background: brandGradientToken, radius: 8, width: 80, height: 80 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(LottieLayerView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('VideoLayerView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    __setVideoAdapterForTests({
      VideoLayerView: StubVideoLayerView,
      ScreenShellVideoBackdrop: () => null,
    });
    const layer: VideoLayer = {
      id: 'lyr_video_gradient',
      kind: 'video',
      loop: true,
      style: { background: brandGradientToken, radius: 8, width: 80, height: 80 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(VideoLayerView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
