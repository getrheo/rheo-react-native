import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StackLayer, TextLayer } from '@getrheo/contracts';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import { StackView } from './layoutLayers';
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
  return { View: passthrough('View') };
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
  it('flex-grows nested stacks unconditionally (Option A) even with height auto', async () => {
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
    expect(style.flex).toBe(1);
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
    const style = view?.props.style as Record<string, unknown>;
    expect(style.flex).toBe(1);
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
    // The flow container is a real flex context that fills its positioning shell
    // so flow children keep a flex parent under the absolute-split structure.
    const flowContainer = styles.find((s) => s.flexDirection === 'row' && s.zIndex === 0);
    expect(flowContainer).toBeDefined();
    expect(flowContainer?.width).toBe('100%');
    expect(flowContainer?.height).toBe('100%');
    // Authored stack size block (flex grow as a flex child) is applied once, on
    // the outer ChromeView — not re-spread onto the flow container.
    expect((root?.props.style ?? {}) as Record<string, unknown>).toMatchObject({ flex: 1 });
    expect(flowContainer?.flex).toBeUndefined();
    tree?.unmount();
  });
});
