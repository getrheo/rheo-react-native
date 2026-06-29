import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlowManifest, Screen } from '@getrheo/contracts';
import { initFlowState, startFlow } from '@getrheo/flow-runtime';
import type { UseFlowResult } from '../useFlow';
import type {LayerRendererProps} from './LayerRenderer';

type ReactTestRenderer = {
  update: (element: ReactNode) => void;
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

const flowMock = vi.hoisted(() => ({
  result: null as UseFlowResult | null,
}));

const renderMock = vi.hoisted(() => ({
  layerRendererProps: [] as LayerRendererProps[],
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: ReactNode }) =>
    React.createElement(name, props, props.children);
  return {
    ActivityIndicator: passthrough('ActivityIndicator'),
    Text: passthrough('Text'),
    View: passthrough('View'),
    Pressable: passthrough('Pressable'),
    StyleSheet: { create: (s: Record<string, unknown>) => s, hairlineWidth: 1 },
  };
});

vi.mock('../useFlow', () => ({
  useFlow: () => {
    if (!flowMock.result) throw new Error('useFlow mock result was not configured');
    return flowMock.result;
  },
}));

vi.mock('../oauthLogin', async () => {
  const React = await import('react');
  return {
    OAuthLoginProvider: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    useOAuthLogin: () => ({ attach: () => () => undefined }),
  };
});

vi.mock('../emailPasswordAuth', async () => {
  const React = await import('react');
  return {
    EmailPasswordAuthProvider: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    useEmailPasswordAuth: () => ({ attach: () => () => undefined }),
  };
});

vi.mock('./Screen', async () => {
  const React = await import('react');
  return {
    ScreenChrome: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
  };
});

vi.mock('./LayerRenderer', async () => {
  const React = await import('react');
  return {
    LayerRenderer: (props: LayerRendererProps) => {
      renderMock.layerRendererProps.push(props);
      return React.createElement('LayerRenderer', {
        screenId: props.screen.id,
        interactive: props.interactive,
      });
    },
  };
});

const screenA: Screen = {
  id: 'scr_a',
  name: 'A',
  next: { default: null },
  regions: { body: { id: 'lyr_body', kind: 'stack', direction: 'vertical', children: [] } },
};

const testManifest = (screen: Screen): FlowManifest => ({
  flowId: '00000000-0000-0000-0000-000000000001',
  version: 1,
  defaultLocale: 'en',
  locales: ['en'],
  entryScreenId: screen.id,
  screens: [screen],
  decisionNodes: [],
  externalSurfaceNodes: [],
  sdkAttributeKeys: [],
});

const makeFlowResult = (screen: Screen): UseFlowResult => {
  const manifest = testManifest(screen);
  const state = startFlow(initFlowState(manifest));
  return {
  loading: false,
  error: null,
  resolveFailed: false,
  retry: vi.fn(),
  state,
  screen,
  manifest,
  pendingExternalSurface: null,
  flowId: 'flow_1',
  versionId: 'ver_1',
  variantId: null,
  branding: null,
  mediaMap: { 'asset-hero': 'https://cdn.test/hero.png' },
  respond: vi.fn(),
  interpolationContext: { responses: {}, customProperties: {}, canGoBack: false },
  relayNativeButtonAction: vi.fn(),
  trackExternalLinkOpened: vi.fn(),
  abandon: vi.fn(),
  };
};

describe('Flow layer motion', () => {
  beforeEach(() => {
    renderMock.layerRendererProps = [];
    flowMock.result = makeFlowResult(screenA);
  });

  it('renders LayerRenderer directly for the active screen', async () => {
    const { Flow } = await import('./Flow');
    await act(async () => {
      TestRenderer.create(createElement(Flow, { channelId: 'ch_test' }));
    });

    expect(renderMock.layerRendererProps).toHaveLength(1);
    expect(renderMock.layerRendererProps[0]?.screen.id).toBe('scr_a');
    expect(renderMock.layerRendererProps[0]?.interactive).toBe(true);
    expect(renderMock.layerRendererProps[0]?.mediaMap).toEqual({
      'asset-hero': 'https://cdn.test/hero.png',
    });
  });
});
