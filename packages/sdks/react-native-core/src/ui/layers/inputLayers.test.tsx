import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import type { CheckboxLayer, ScaleInputLayer, TextInputLayer } from '@getrheo/contracts';
import type { BrandGradient, Branding } from '@getrheo/contracts/branding';
import { BRAND_GRADIENT_PREFIX } from '@getrheo/flow-runtime';
import { CheckboxView, ScaleInputView, TextInputView } from './inputLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type TestNode = { props: Record<string, unknown> };
type ReactTestRenderer = {
  root: {
    findByType: (type: string) => TestNode;
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

vi.mock('@react-native-community/slider', () => ({
  default: (props: Record<string, unknown>) => createElement('Slider', props),
}));

vi.mock('@getrheo/flow-ui-state', () => ({
  useScreenCheckboxAck: () => ({
    checked: {},
    toggle: vi.fn(),
  }),
}));

vi.mock('@getrheo/flow-ui-state/draft', () => ({
  useScreenInputDraft: () => null,
}));

vi.mock('react-native-linear-gradient', () => ({
  default: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: ReactNode }) =>
    React.createElement(name, props, props.children);
  return {
    Text: passthrough('Text'),
    View: passthrough('View'),
    Pressable: passthrough('Pressable'),
    TextInput: passthrough('TextInput'),
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

describe('CheckboxView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: CheckboxLayer = {
      id: 'lyr_chk_gradient',
      kind: 'checkbox',
      fieldKey: 'agree',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(CheckboxView, { layer, ctx: gradientCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });

  it('does not force alignSelf stretch when width is hug/auto', async () => {
    const layer: CheckboxLayer = {
      id: 'lyr_chk_hug',
      kind: 'checkbox',
      fieldKey: 'agree',
      style: { width: 'auto' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(createElement(CheckboxView, { layer, ctx: smokeCtx() }));
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).alignSelf).not.toBe('stretch');
    tree?.unmount();
  });
});

describe('TextInputView brand gradient overflow clip', () => {
  it('sets overflow hidden on field chrome when background is a brand gradient', async () => {
    const layer: TextInputLayer = {
      id: 'lyr_ti_gradient',
      kind: 'text_input',
      fieldKey: 'name',
      classification: 'safe',
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(TextInputView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const fieldChrome = tree!.root
      .findAllByType('View')
      .map((node) => flattenStyle(node.props.style))
      .find((style) => style.overflow === 'hidden');
    expect(fieldChrome?.overflow).toBe('hidden');
    tree?.unmount();
  });

  it('applies authored style chrome to the field shell, not a hardcoded gray input', async () => {
    const layer: TextInputLayer = {
      id: 'lyr_ti_chrome',
      kind: 'text_input',
      fieldKey: 'name',
      classification: 'safe',
      style: { background: '#ffffff', border: { width: 2, color: '#000000' }, radius: 24 },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(TextInputView, { layer, ctx: smokeCtx({ theme: 'light' }), renderLayer: noopRender }),
      );
    });
    const fieldChrome = tree!.root
      .findAllByType('View')
      .map((node) => flattenStyle(node.props.style))
      .find((style) => style.backgroundColor === '#ffffff');
    expect(fieldChrome).toMatchObject({
      backgroundColor: '#ffffff',
      borderWidth: 2,
      borderColor: '#000000',
      borderRadius: 24,
    });
    const input = tree!.root.findByType('TextInput');
    expect(flattenStyle(input.props.style).backgroundColor).toBe('transparent');
    tree?.unmount();
  });
});

describe('ScaleInputView brand gradient overflow clip', () => {
  it('sets overflow hidden on outer chrome when background is a brand gradient', async () => {
    const layer: ScaleInputLayer = {
      id: 'lyr_scale_gradient',
      kind: 'scale_input',
      fieldKey: 'level',
      min: 1,
      max: 5,
      defaultValue: 3,
      style: { background: brandGradientToken, radius: 8, width: 'full' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScaleInputView, { layer, ctx: gradientCtx(), renderLayer: noopRender }),
      );
    });
    const root = tree!.root.findAllByType('View')[0];
    expect(flattenStyle(root?.props.style).overflow).toBe('hidden');
    tree?.unmount();
  });

  it('stretches endpoint label row so min and max labels space apart', async () => {
    const layer: ScaleInputLayer = {
      id: 'lyr_scale_labels',
      kind: 'scale_input',
      fieldKey: 'rating',
      min: 1,
      max: 5,
      defaultValue: 5,
      minLabel: { default: 'Very bad' },
      maxLabel: { default: 'Very good' },
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScaleInputView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const labelRow = tree!.root
      .findAllByType('View')
      .map((node) => flattenStyle(node.props.style))
      .find((style) => style.flexDirection === 'row' && style.justifyContent === 'space-between');
    expect(labelRow?.alignSelf).toBe('stretch');
    tree?.unmount();
  });

  it('maps trackHeight into Slider height (at least trackHeight)', async () => {
    const layer: ScaleInputLayer = {
      id: 'lyr_scale_track',
      kind: 'scale_input',
      fieldKey: 'rating',
      min: 1,
      max: 5,
      defaultValue: 3,
      trackHeight: 12,
      thumbSize: 8,
    };
    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(ScaleInputView, { layer, ctx: smokeCtx(), renderLayer: noopRender }),
      );
    });
    const slider = tree!.root.findByType('Slider');
    const style = flattenStyle(slider.props.style);
    expect(style.height).toBeGreaterThanOrEqual(12);
    tree?.unmount();
  });
});
