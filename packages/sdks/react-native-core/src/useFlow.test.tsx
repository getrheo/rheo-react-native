import { describe, expect, it, vi } from 'vitest';
import { createElement, useEffect, type ReactNode } from 'react';
// react-test-renderer ships no @types. Untyped require avoids adding a dev-dep
// just to satisfy the test seam below.
type ReactTestRenderer = { unmount: () => void };
type RtrModule = {
  create: (e: ReactNode) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;
import type { FlowManifest, FlowTerminalSnapshot, SdkResolveResponse } from '@getrheo/contracts';
import { RheoProvider } from './client';
import { useFlow, type ExternalSurfacePresenter, type UseFlowResult } from './useFlow';
import type {RevenueCatPresentResult} from './externalSurfaces/revenueCat';

const manifest: FlowManifest = {
  flowId: '11111111-1111-1111-1111-111111111111',
  schemaVersion: 7,
  version: 1,
  defaultLocale: 'en',
  locales: ['en'],
  entryScreenId: 'scr_welcome',
  screens: [
    {
      id: 'scr_welcome',
      name: 'Welcome',
      regions: {
        body: {
          id: 'lyr_welcome_body',
          kind: 'stack',
          direction: 'vertical',
          children: [
            {
              id: 'lyr_welcome_btn',
              kind: 'button',
              variant: 'primary',
              action: { kind: 'continue' },
              children: [
                { id: 'lyr_welcome_btn_text', kind: 'text', text: { default: 'Continue' } },
              ],
            },
          ],
        },
      },
      next: { default: 'surf_paywall' },
    },
    {
      id: 'scr_done',
      name: 'Done',
      regions: {
        body: {
          id: 'lyr_done_body',
          kind: 'stack',
          direction: 'vertical',
          children: [{ id: 'lyr_done_t', kind: 'text', text: { default: 'Done' } }],
        },
      },
      next: { default: null },
    },
  ],
  decisionNodes: [],
  externalSurfaceNodes: [
    {
      id: 'surf_paywall',
      config: { provider: 'revenuecat', offeringId: 'default' },
      outcomes: { purchase_completed: 'scr_done', dismissed: 'scr_done' },
      fallback: 'scr_done',
    },
  ],
  sdkAttributeKeys: [],
};

const resolveResponse: SdkResolveResponse = {
  flowId: manifest.flowId,
  versionId: '22222222-2222-2222-2222-222222222222',
  versionNumber: 1,
  assignmentVersion: 1,
  environment: 'test',
  channelId: 'ch_test_xyz',
  experimentId: null,
  variantId: null,
  manifest,
  mediaMap: {},
  features: { attribution: true },
  integrations: {
    revenuecat: { enabled: false, defaultOfferingId: '', defaultPlacementId: '' },
    appsflyer: { enabled: true },
  },
};

const makeFetcher = (): typeof fetch =>
  vi.fn(async () =>
    new Response(JSON.stringify(resolveResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;

type Harness = { current: UseFlowResult | null };

const HarnessComponent = ({
  harness,
  presenter,
  onFlowCompleted,
  onFlowAbandoned,
}: {
  harness: Harness;
  presenter?: ExternalSurfacePresenter;
  onFlowCompleted?: (payload: FlowTerminalSnapshot) => void;
  onFlowAbandoned?: (payload: FlowTerminalSnapshot) => void;
}) => {
  const result = useFlow({
    channelId: 'ch_test_xyz',
    externalSurfacePresenter: presenter,
    onFlowCompleted,
    onFlowAbandoned,
  });
  useEffect(() => {
    harness.current = result;
  });
  return null;
};

const flush = async () => {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};

const renderHarness = (harness: Harness, presenter?: ExternalSurfacePresenter) =>
  TestRenderer.create(
    createElement(
      RheoProvider,
      {
        config: {
          publishableKey: 'ob_pk_test_abc',
          apiBaseUrl: 'https://api.test',
          fetcher: makeFetcher(),
        },
        children: createElement(HarnessComponent, { harness, presenter }) as ReactNode,
      },
    ),
  );

describe('useFlow external surface integration', () => {
  it('presents the RevenueCat surface and advances on purchase_completed', async () => {
    // Use a deferred presenter so we can assert the intermediate `pending` state.
    let resolvePresenter: ((value: RevenueCatPresentResult) => void) | null = null;
    const presenter: ExternalSurfacePresenter = vi.fn(
      () =>
        new Promise<RevenueCatPresentResult>((res) => {
          resolvePresenter = res;
        }),
    );
    const harness: Harness = { current: null };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderHarness(harness, presenter);
    });
    await flush();

    expect(harness.current?.error).toBeNull();
    expect(harness.current?.loading).toBe(false);
    expect(harness.current?.screen?.id).toBe('scr_welcome');

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    expect(harness.current?.pendingExternalSurface?.id).toBe('surf_paywall');
    expect(harness.current?.screen).toBeUndefined();

    // Resolve the presenter; flow should advance to `scr_done`.
    await act(async () => {
      resolvePresenter?.({
        outcome: 'purchase_completed',
        sdkKeyPatch: {
          onb_rc_last_event: 'purchase_completed',
          onb_rc_last_product_id: 'pro.year',
        },
      });
    });
    await flush();
    expect(presenter).toHaveBeenCalledTimes(1);
    expect(harness.current?.screen?.id).toBe('scr_done');
    expect(harness.current?.state?.session.sdkAttributes.onb_rc_last_product_id).toBe('pro.year');

    tree?.unmount();
  });

  it('only presents the surface once per pending node id', async () => {
    const presenter: ExternalSurfacePresenter = vi.fn(
      () => new Promise<RevenueCatPresentResult>(() => undefined), // never resolves
    );
    const harness: Harness = { current: null };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderHarness(harness, presenter);
    });
    await flush();

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    await flush();
    await flush();
    expect(presenter).toHaveBeenCalledTimes(1);

    tree?.unmount();
  });

  it('enqueues iap_purchase with commerce details on purchase_completed', async () => {
    const presenter: ExternalSurfacePresenter = vi.fn(
      async (): Promise<RevenueCatPresentResult> => ({
        outcome: 'purchase_completed',
        sdkKeyPatch: {
          onb_rc_last_event: 'purchase_completed',
          onb_rc_last_product_id: 'pro_annual',
        },
        commerce: {
          product_id: 'pro_annual',
          offering_id: 'default',
          package_id: '$rc_annual',
          price: 49.99,
          currency: 'USD',
          period_type: 'normal',
        },
      }),
    );
    const harness: Harness = { current: null };
    const eventNames: string[] = [];
    const iapProperties: Record<string, unknown>[] = [];

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1/sdk/resolve')) {
        return new Response(JSON.stringify(resolveResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/v1/sdk/events')) {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as {
          events?: Array<{ name: string; properties?: Record<string, unknown> }>;
        };
        for (const e of parsed.events ?? []) {
          eventNames.push(e.name);
          if (e.name === 'iap_purchase' && e.properties) iapProperties.push(e.properties);
        }
        return new Response('{}', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(
          RheoProvider,
          {
            config: {
              publishableKey: 'ob_pk_test_abc',
              apiBaseUrl: 'https://api.test',
              fetcher: fetchMock as unknown as typeof fetch,
            },
            children: createElement(HarnessComponent, { harness, presenter }) as ReactNode,
          },
        ),
      );
    });
    await flush();

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    await flush();
    // Force a queue drain — `iap_purchase` is not a terminal event so it
    // would otherwise wait for the 5s debounce timer. Unmount triggers
    // `shutdown()` which drains the pending buffer through `fetch`.
    await act(async () => {
      tree?.unmount();
    });
    await flush();

    expect(eventNames).toContain('iap_purchase');
    expect(eventNames.indexOf('surface_outcome')).toBeLessThan(eventNames.indexOf('iap_purchase'));
    expect(iapProperties[0]).toMatchObject({
      provider: 'revenuecat',
      surface_node_id: 'surf_paywall',
      product_id: 'pro_annual',
      price: 49.99,
      currency: 'USD',
    });
  });

  it('emits surface_outcome `failed` when the presenter throws', async () => {
    const presenter: ExternalSurfacePresenter = vi.fn(
      () => Promise.reject(new Error('presenter blew up')) as Promise<RevenueCatPresentResult>,
    );
    const harness: Harness = { current: null };
    const eventNames: string[] = [];

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1/sdk/resolve')) {
        return new Response(JSON.stringify(resolveResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/v1/sdk/events')) {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as {
          events?: { name: string }[];
        };
        for (const e of parsed.events ?? []) eventNames.push(e.name);
        return new Response('{}', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(
          RheoProvider,
          {
            config: {
              publishableKey: 'ob_pk_test_abc',
              apiBaseUrl: 'https://api.test',
              fetcher: fetchMock as unknown as typeof fetch,
            },
            children: createElement(HarnessComponent, { harness, presenter }) as ReactNode,
          },
        ),
      );
    });
    await flush();

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    await flush();
    await act(async () => {
      tree?.unmount();
    });
    await flush();

    expect(eventNames.filter((n) => n === 'surface_outcome').length).toBe(1);
  });

  it('uses the fallback edge when the outcome is failed and unmapped', async () => {
    const presenter: ExternalSurfacePresenter = vi.fn(
      async (): Promise<RevenueCatPresentResult> => ({
        outcome: 'failed',
        sdkKeyPatch: { onb_rc_last_event: 'failed' },
      }),
    );
    const harness: Harness = { current: null };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderHarness(harness, presenter);
    });
    await flush();

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    await flush();
    expect(harness.current?.screen?.id).toBe('scr_done');

    tree?.unmount();
  });
});

const LINEAR_FLOW_ID = '44444444-4444-4444-4444-444444444444';

const linearManifest: FlowManifest = {
  flowId: LINEAR_FLOW_ID,
  schemaVersion: 7,
  version: 1,
  defaultLocale: 'en',
  locales: ['en'],
  entryScreenId: 'scr_a',
  screens: [
    {
      id: 'scr_a',
      name: 'A',
      regions: {
        body: {
          id: 'lyr_a_body',
          kind: 'stack',
          direction: 'vertical',
          children: [
            {
              id: 'lyr_a_btn',
              kind: 'button',
              variant: 'primary',
              action: { kind: 'continue' },
              children: [{ id: 'lyr_a_t', kind: 'text', text: { default: 'Go' } }],
            },
          ],
        },
      },
      next: { default: 'scr_b' },
    },
    {
      id: 'scr_b',
      name: 'B',
      regions: {
        body: {
          id: 'lyr_b_body',
          kind: 'stack',
          direction: 'vertical',
          children: [
            {
              id: 'lyr_b_btn',
              kind: 'button',
              variant: 'primary',
              action: { kind: 'continue' },
              children: [{ id: 'lyr_b_t', kind: 'text', text: { default: 'Done' } }],
            },
          ],
        },
      },
      next: { default: null },
    },
  ],
  decisionNodes: [],
  externalSurfaceNodes: [],
  sdkAttributeKeys: [],
};

const linearResolve: SdkResolveResponse = {
  flowId: LINEAR_FLOW_ID,
  versionId: '55555555-5555-5555-5555-555555555555',
  versionNumber: 1,
  assignmentVersion: 2,
  environment: 'test',
  channelId: 'ch_test_linear',
  experimentId: null,
  variantId: null,
  manifest: linearManifest,
  mediaMap: {},
  features: { attribution: false },
  integrations: {
    revenuecat: { enabled: false, defaultOfferingId: '', defaultPlacementId: '' },
    appsflyer: { enabled: false },
  },
};

describe('useFlow terminal payloads', () => {
  const LinearHarness = ({
    harness,
    onFlowCompleted,
    onFlowAbandoned,
  }: {
    harness: Harness;
    onFlowCompleted?: (payload: FlowTerminalSnapshot) => void;
    onFlowAbandoned?: (payload: FlowTerminalSnapshot) => void;
  }) => {
    const result = useFlow({
      channelId: 'ch_test_linear',
      onFlowCompleted,
      onFlowAbandoned,
    });
    useEffect(() => {
      harness.current = result;
    });
    return null;
  };

  const renderLinearHarness = (
    harness: Harness,
    callbacks?: {
      onFlowCompleted?: (payload: FlowTerminalSnapshot) => void;
      onFlowAbandoned?: (payload: FlowTerminalSnapshot) => void;
    },
  ) =>
    TestRenderer.create(
      createElement(
        RheoProvider,
        {
          config: {
            publishableKey: 'ob_pk_test_abc',
            apiBaseUrl: 'https://api.test',
            fetcher: vi.fn(async () =>
              new Response(JSON.stringify(linearResolve), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }),
            ) as unknown as typeof fetch,
            userId: 'terminal-flow-user',
          },
          children: createElement(LinearHarness, {
            harness,
            onFlowCompleted: callbacks?.onFlowCompleted,
            onFlowAbandoned: callbacks?.onFlowAbandoned,
          }) as ReactNode,
        },
      ),
    );

  it('fires onFlowCompleted with assignment and identity after terminal navigation', async () => {
    const onFlowCompleted = vi.fn();
    const harness: Harness = { current: null };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderLinearHarness(harness, { onFlowCompleted });
    });
    await flush();

    expect(harness.current?.loading).toBe(false);
    expect(harness.current?.screen?.id).toBe('scr_a');

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    expect(harness.current?.screen?.id).toBe('scr_b');

    await act(async () => {
      harness.current?.respond({ kind: 'cta', action: 'primary' });
    });
    await flush();
    await flush();

    expect(harness.current?.state?.status).toBe('completed');
    expect(onFlowCompleted).toHaveBeenCalledTimes(1);
    const payload = onFlowCompleted.mock.calls[0]?.[0];
    expect(payload?.schemaVersion).toBe(1);
    expect(payload?.terminal).toBe('completed');
    expect(payload?.correlation.channelId).toBe('ch_test_linear');
    expect(payload?.correlation.flowId).toBe(LINEAR_FLOW_ID);
    expect(payload?.subject.appUserId).toBe('terminal-flow-user');
    expect(payload?.manifest).toBeUndefined();
    expect(payload?.path).toBeUndefined();
    expect(Object.keys(payload?.answers ?? {}).length).toBeGreaterThanOrEqual(1);

    tree?.unmount();
  });

  it('abandon enqueues flow_abandoned once and does not duplicate on unmount', async () => {
    const onFlowAbandoned = vi.fn();
    const harness: Harness = { current: null };
    const eventNames: string[] = [];

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1/sdk/resolve')) {
        return new Response(JSON.stringify(linearResolve), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/v1/sdk/events')) {
        const raw = String(init?.body ?? '{}');
        const parsed = JSON.parse(raw) as { events?: { name: string }[] };
        for (const e of parsed.events ?? []) {
          eventNames.push(e.name);
        }
        return new Response('{}', { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(
          RheoProvider,
          {
            config: {
              publishableKey: 'ob_pk_test_abc',
              apiBaseUrl: 'https://api.test',
              fetcher: fetchMock as unknown as typeof fetch,
              userId: 'terminal-flow-user',
            },
            children: createElement(LinearHarness, {
              harness,
              onFlowAbandoned,
            }) as ReactNode,
          },
        ),
      );
    });
    await flush();

    expect(eventNames.filter((n) => n === 'flow_abandoned').length).toBe(0);

    await act(async () => {
      harness.current?.abandon();
    });
    await flush();
    await flush();

    expect(harness.current?.state?.status).toBe('abandoned');
    expect(onFlowAbandoned).toHaveBeenCalledTimes(1);
    expect(onFlowAbandoned.mock.calls[0]?.[0]?.terminal).toBe('abandoned');
    expect(eventNames.filter((n) => n === 'flow_abandoned').length).toBe(1);

    await act(async () => {
      tree?.unmount();
    });
    await flush();

    expect(eventNames.filter((n) => n === 'flow_abandoned').length).toBe(1);
  });
});

describe('useFlow mediaMap', () => {
  it('surfaces CDN URLs from resolve for LayerRenderer', async () => {
    const mediaResolve: SdkResolveResponse = {
      ...resolveResponse,
      mediaMap: {
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'https://cdn.test/hero.png',
      },
    };
    const harness: Harness = { current: null };

    let tree: ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(
          RheoProvider,
          {
            config: {
              publishableKey: 'ob_pk_test_abc',
              apiBaseUrl: 'https://api.test',
              fetcher: vi.fn(async () =>
                new Response(JSON.stringify(mediaResolve), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                }),
              ) as unknown as typeof fetch,
            },
            children: createElement(HarnessComponent, { harness }) as ReactNode,
          },
        ),
      );
    });
    await flush();

    expect(harness.current?.mediaMap).toEqual({
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'https://cdn.test/hero.png',
    });

    tree?.unmount();
  });
});
