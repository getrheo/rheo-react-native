import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { WheelPickerLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX } from '@getrheo/flow-runtime';
import { WheelPickerView } from './wheelPickerLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown> };
type ReactTestRenderer = {
  root: {
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
  const passthrough = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props);
  return {
    View: passthrough('View'),
    Text: passthrough('Text'),
    FlatList: passthrough('FlatList'),
    Pressable: passthrough('Pressable'),
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

const noopRender: RenderLayer = () => null;

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style as Record<string, unknown>;
};

describe('WheelPickerView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: WheelPickerLayer = {
      id: 'lyr_wheel_gradient',
      kind: 'wheel_picker',
      fieldKey: 'year',
      mode: 'date',
      datePart: 'year',
      minYear: 2000,
      maxYear: 2005,
      defaultValue: '2002',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(WheelPickerView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });
});
