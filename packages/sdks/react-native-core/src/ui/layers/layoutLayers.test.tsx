import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { HyperlinkLayer, StackLayer, TextLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import { BRAND_GRADIENT_PREFIX } from '@getrheo/flow-runtime';
import { HyperlinkView, StackView, TextView } from './layoutLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown>; children?: TestNode[] };
type ReactTestRenderer = {
  root: { findAllByType: (type: string) => TestNode[] };
  unmount: () => void;
};
type RtrModule = {
  create: (element: unknown) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement(name, props, props.children);
  return {
    View: passthrough('View'),
    Text: passthrough('Text'),
    Pressable: passthrough('Pressable'),
    StyleSheet: { create: (s: Record<string, unknown>) => s, absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
  };
});

vi.mock('react-native-linear-gradient', () => ({ default: () => null }));

const smokeCtx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen('scr_sm_button'),
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

const collectViewStyles = (node: TestNode | undefined): Array<Record<string, unknown>> => {
  if (!node) return [];
  const out: Array<Record<string, unknown>> = [];
  if (node.props.style) {
    const style = node.props.style;
    if (Array.isArray(style)) out.push(...style.filter(Boolean));
    else out.push(style as Record<string, unknown>);
  }
  for (const child of node.children ?? []) {
    out.push(...collectViewStyles(child));
  }
  return out;
};

describe('StackView flex grow', () => {
  it('does not flex-grow nested stacks with height auto (hug wins)', async () => {
    const layer: StackLayer = {
      id: 'lyr_nested_hug',
      kind: 'stack',
      direction: 'vertical',
      gap: 0,
      style: { width: 'full', height: 'auto' },
      children: [],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(StackView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const view = tree!.root.findAllByType('View')[0];
    const style = view?.props.style as Record<string, unknown>;
    expect(style.flex).toBeUndefined();
    tree?.unmount();
  });

  it('flex-grows nested stacks when height is fill', async () => {
    const layer: StackLayer = {
      id: 'lyr_nested_fill',
      kind: 'stack',
      direction: 'vertical',
      gap: 0,
      style: { width: 'full', height: 'fill' },
      children: [],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(StackView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const view = tree!.root.findAllByType('View')[0];
    const style = flattenStyle(view?.props.style);
    expect(style.flex).toBe(1);
    expect(style.height).toBe('100%');
    tree?.unmount();
  });
});

describe('StackView absolute layering', () => {
  it('splits flow and absolute children with a relative positioning shell', async () => {
    const absoluteText: TextLayer = {
      id: 'lyr_abs',
      kind: 'text',
      text: { default: 'Behind' },
      style: { position: 'absolute', inset: { t: 8 }, zIndex: -10 },
    };
    const layer: StackLayer = {
      id: 'lyr_story_body',
      kind: 'stack',
      direction: 'horizontal',
      distribution: 'between',
      style: { width: 'full', height: 'fill' },
      children: [
        {
          id: 'lyr_tap',
          kind: 'stack',
          direction: 'vertical',
          style: { width: 'full', height: 'fill' },
          children: [],
        },
        absoluteText,
      ],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(StackView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    const styles = collectViewStyles(root);
    expect(styles.some((s) => s.position === 'relative')).toBe(true);
    expect(styles.some((s) => s.zIndex === 0)).toBe(true);
    const flowContainer = styles.find((s) => s.flexDirection === 'row' && s.zIndex === 0);
    expect(flowContainer).toBeDefined();
    expect(flowContainer?.width).toBe('100%');
    expect(flowContainer?.height).toBe('100%');
    expect((root?.props.style ?? {}) as Record<string, unknown>).toMatchObject({ flex: 1 });
    expect(flowContainer?.flex).toBeUndefined();
    tree?.unmount();
  });
});

describe('StackView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: StackLayer = {
      id: 'lyr_stack_gradient',
      kind: 'stack',
      direction: 'vertical',
      style: { background: brandGradientToken, radius: 12, width: 'full' },
      children: [],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(StackView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('TextView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: TextLayer = {
      id: 'lyr_text_gradient',
      kind: 'text',
      text: { default: 'Hello' },
      style: { background: brandGradientToken, radius: 8, fontSize: 16 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(TextView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});

describe('HyperlinkView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: HyperlinkLayer = {
      id: 'lyr_link_gradient',
      kind: 'hyperlink',
      href: 'https://example.com',
      direction: 'horizontal',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
      children: [
        {
          id: 'lyr_link_lbl',
          kind: 'text',
          text: { default: 'Learn more' },
          style: { fontSize: 14 },
        },
      ],
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(HyperlinkView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
