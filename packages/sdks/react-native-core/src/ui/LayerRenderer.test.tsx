import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildStressHarnessManifest } from '@rheo/seeds';
import type { Screen } from '@getrheo/contracts';
import type { ViewStyle } from 'react-native';

type ReactTestRenderer = {
  root: { children: unknown[] };
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

const capturedViewStyles: Array<ViewStyle | ViewStyle[] | undefined> = [];

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: ReactNode }) =>
    React.createElement(name as 'motion-div', props, props.children);
  return {
    View: (props: { style?: ViewStyle | ViewStyle[]; children?: ReactNode }) => {
      capturedViewStyles.push(props.style);
      return React.createElement('View', props, props.children);
    },
    Text: passthrough('Text'),
    Image: passthrough('Image'),
    ScrollView: passthrough('ScrollView'),
    useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => false,
      addEventListener: () => ({ remove: () => undefined }),
    },
    StyleSheet: { hairlineWidth: 1, absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
  };
});

vi.mock('lottie-react-native', () => ({
  default: () => null,
}));

vi.mock('@react-native-community/slider', () => ({
  default: (props: { children?: unknown }) => props.children ?? null,
}));

vi.mock('react-native-gesture-handler', () => ({
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
  GestureDetector: (props: { children?: unknown }) => props.children ?? null,
  GestureHandlerRootView: (props: { children?: unknown }) => props.children ?? null,
}));

const reanimatedMock = vi.hoisted(() => ({
  withTiming: vi.fn((v: unknown) => v),
}));

vi.mock('react-native-reanimated', () => {
  const noop = () => undefined;
  const Animated = {
    View: (props: { children?: unknown }) => props.children ?? null,
    createAnimatedComponent: <T,>(Comp: T): T => Comp,
  };
  return {
    default: Animated,
    createAnimatedComponent: <T,>(Comp: T): T => Comp,
    interpolate: () => 1,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: () => ({}),
    useAnimatedReaction: noop,
    useSharedValue: (value: number) => ({ value }),
    withTiming: reanimatedMock.withTiming,
    withDelay: (_d: number, v: unknown) => v,
    runOnJS: (fn: () => void) => fn,
    cancelAnimation: noop,
    Easing: { bezier: () => 'bezier', inOut: noop, ease: noop, linear: 'linear' },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: { children?: unknown }) => props.children ?? null,
  SafeAreaProvider: (props: { children?: unknown }) => props.children ?? null,
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

describe('LayerRenderer module', () => {
  it('loads LayerRenderer exports without crashing', async () => {
    const mod = await import('./LayerRenderer');
    expect(typeof mod.LayerRenderer).toBe('function');
  });

  it('loads ScreenChrome from Screen module', async () => {
    const mod = await import('./Screen');
    expect(typeof mod.ScreenChrome).toBe('function');
  });

  it('renderToTree smoke for one stress-harness screen in preview mode', async () => {
    const { LayerRenderer } = await import('./LayerRenderer');
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_regions');
    if (!screen) throw new Error('stress regions screen missing');

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LayerRenderer, {
          manifest,
          screen,
          interactive: false,
          theme: 'light',
        }),
      );
    });
    expect(tree!.root.children.length).toBeGreaterThan(0);
    tree?.unmount();
  });

  it('arms mount clips on nested layers, not only region roots', async () => {
    reanimatedMock.withTiming.mockClear();
    const { LayerRenderer } = await import('./LayerRenderer');
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_regions');
    if (!screen) throw new Error('stress regions screen missing');
    const nestedTarget = screen.animations?.[0]?.targetLayerId;
    expect(nestedTarget).toBe('lyr_sh_rg_body_txt');

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LayerRenderer, {
          manifest,
          screen,
          interactive: false,
          theme: 'light',
        }),
      );
    });
    expect(reanimatedMock.withTiming).toHaveBeenCalled();
    tree?.unmount();
  });

  it('applies screen container padding when a media shell backdrop is present', async () => {
    capturedViewStyles.length = 0;
    const { LayerRenderer } = await import('./LayerRenderer');
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_regions');
    if (!screen) throw new Error('stress regions screen missing');

    const screenWithShellPadding: Screen = {
      ...screen,
      containerStyle: {
        padding: { t: 20, r: 24, b: 20, l: 24 },
        backgroundFill: {
          kind: 'image',
          media: { mediaAssetId: 'asset-bg' },
        },
      },
    };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LayerRenderer, {
          manifest,
          screen: screenWithShellPadding,
          interactive: false,
          theme: 'light',
          mediaMap: { 'asset-bg': 'https://example.com/bg.jpg' },
        }),
      );
    });

    const flatStyles = capturedViewStyles.flatMap((style) =>
      Array.isArray(style) ? style : style ? [style] : [],
    );
    expect(
      flatStyles.some(
        (style) =>
          style.paddingTop === 20 &&
          style.paddingRight === 24 &&
          style.paddingBottom === 20 &&
          style.paddingLeft === 24,
      ),
    ).toBe(true);
    tree?.unmount();
  });

  it('merges insetSafeArea with device safe-area insets on the shell', async () => {
    capturedViewStyles.length = 0;
    const { LayerRenderer } = await import('./LayerRenderer');
    const manifest = buildStressHarnessManifest('00000000-0000-0000-0000-00000000beef');
    const screen = manifest.screens.find((s) => s.id === 'scr_sh_regions');
    if (!screen) throw new Error('stress regions screen missing');

    const screenWithInsetSafeArea: Screen = {
      ...screen,
      containerStyle: {
        insetSafeArea: true,
        padding: { t: 8, l: 12 },
      },
    };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(LayerRenderer, {
          manifest,
          screen: screenWithInsetSafeArea,
          interactive: false,
          theme: 'light',
        }),
      );
    });

    const flatStyles = capturedViewStyles.flatMap((style) =>
      Array.isArray(style) ? style : style ? [style] : [],
    );
    expect(
      flatStyles.some(
        (style) =>
          style.paddingTop === 52 &&
          style.paddingBottom === 34 &&
          style.paddingLeft === 12,
      ),
    ).toBe(true);
    tree?.unmount();
  });
});
