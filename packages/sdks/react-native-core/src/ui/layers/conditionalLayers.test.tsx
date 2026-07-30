import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ConditionalLayer, Layer, StackLayer } from '@getrheo/contracts';
import { layerSmokeManifest, layerSmokeScreen } from '@rheo/contracts-fixtures/layerSmoke';
import { ConditionalView } from './conditionalLayers';
import type { Ctx, RenderLayer } from '../LayerRendererShared';

type ReactTestRenderer = {
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
  const passthrough = (name: string) => (props: { children?: React.ReactNode }) =>
    React.createElement(name, props, props.children);
  return {
    View: passthrough('View'),
    Text: passthrough('Text'),
    StyleSheet: { create: (s: Record<string, unknown>) => s, absoluteFillObject: {} },
  };
});

vi.mock('react-native-linear-gradient', () => ({ default: () => null }));

const branchStack = (id: string): StackLayer => ({
  id,
  kind: 'stack',
  direction: 'vertical',
  children: [{ id: `${id}_text`, kind: 'text', text: { default: id } }],
});

const platformCase = (platform: string, caseId: string, rootLayerId: string) => ({
  id: caseId,
  expression: {
    kind: 'predicate' as const,
    variable: { kind: 'builtin' as const, name: 'platform' as const },
    predicate: { type: 'string' as const, pred: { op: 'eq' as const, value: platform } },
  },
  rootLayerId,
});

const conditional = (): ConditionalLayer => ({
  id: 'lyr_cond',
  kind: 'conditional',
  cases: [
    platformCase('ios', 'case_ios', 'lyr_cond_ios'),
    platformCase('android', 'case_android', 'lyr_cond_android'),
  ],
  elseRootLayerId: 'lyr_cond_else',
  children: [
    branchStack('lyr_cond_ios'),
    branchStack('lyr_cond_android'),
    branchStack('lyr_cond_else'),
  ],
});

const ctx = (overrides?: Partial<Ctx>): Ctx => ({
  manifest: layerSmokeManifest(),
  screen: layerSmokeScreen('scr_sm_button'),
  locale: 'en',
  interactive: false,
  theme: 'dark',
  ...overrides,
});

const renderedBranchId = async (c: Ctx): Promise<string | undefined> => {
  let seen: string | undefined;
  const capture: RenderLayer = (layer: Layer) => {
    seen = layer.id;
    return null;
  };
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(
      createElement(ConditionalView, { layer: conditional(), ctx: c, renderLayer: capture }),
    );
  });
  tree?.unmount();
  return seen;
};

describe('ConditionalView', () => {
  it('renders the branch whose case matches the platform', async () => {
    expect(await renderedBranchId(ctx({ conditionalEval: { platform: 'android' } }))).toBe(
      'lyr_cond_android',
    );
  });

  it('falls back to the else stack when no case matches', async () => {
    expect(await renderedBranchId(ctx({ conditionalEval: { platform: 'web' } }))).toBe(
      'lyr_cond_else',
    );
  });

  it('honors a pinned case preview over live evaluation', async () => {
    expect(
      await renderedBranchId(
        ctx({
          conditionalEval: { platform: 'android' },
          conditionalCasePreview: { lyr_cond: 'case_ios' },
        }),
      ),
    ).toBe('lyr_cond_ios');
  });
});
