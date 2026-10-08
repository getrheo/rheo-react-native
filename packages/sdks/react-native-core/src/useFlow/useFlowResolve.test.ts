import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect } from 'react';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { RheoProvider } from '../client.js';
import { useFlow, type UseFlowResult } from './useFlow.js';
import * as resolveChannelModule from '../resolve/resolveChannel.js';

type ReactTestRenderer = { unmount: () => void };
type RtrModule = {
  create: (el: unknown) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;

const sampleResolve = (): SdkResolveResponse =>
  ({
    kind: 'flow',
    flowId: '00000000-0000-4000-8000-000000000001',
    versionId: '00000000-0000-4000-8000-000000000002',
    versionNumber: 1,
    assignmentVersion: 1,
    environment: 'test',
    channelId: 'ch_test',
    experimentId: null,
    variantId: null,
    experiment: null,
    manifest: {
      flowId: '00000000-0000-4000-8000-000000000001',
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
              id: 'lyr_stack',
              kind: 'stack',
              direction: 'vertical',
              children: [],
            },
          },
          next: { default: null },
        },
      ],
      decisionNodes: [],
      externalSurfaceNodes: [],
      sdkAttributeKeys: [],
    },
    mediaMap: {},
    integrations: {
      revenuecat: { enabled: false, defaultOfferingId: '', defaultPlacementId: '' },
      superwall: { enabled: false, defaultPlacementId: '' },
      appsflyer: { enabled: false },
      stripe: { enabled: false },
    },
  }) satisfies SdkResolveResponse;

type HarnessState = { latest: UseFlowResult | null };

const Harness = ({
  onUpdate,
}: {
  onUpdate: (r: UseFlowResult) => void;
}) => {
  const result = useFlow({ channelId: 'ch_test' });
  useEffect(() => {
    onUpdate(result);
  }, [onUpdate, result]);
  return null;
};

describe('useFlow resolve retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets resolveFailed and error when resolve throws', async () => {
    vi.spyOn(resolveChannelModule, 'resolveChannel').mockRejectedValue(
      new Error('network down'),
    );
    const harness: HarnessState = { latest: null };
    const tree = TestRenderer.create(
      createElement(RheoProvider, {
        config: {
          publishableKey: 'ob_pk_test',
          apiBaseUrl: 'https://api.test',
          userId: 'u1',
        },
        children: createElement(Harness, {
          onUpdate: (r) => {
            harness.latest = r;
          },
        }),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.latest?.resolveFailed).toBe(true);
    expect(harness.latest?.error?.message).toBe('network down');
    expect(harness.latest?.manifest).toBeNull();
    tree.unmount();
  });

  it('retry() re-runs resolve and clears resolveFailed on success', async () => {
    let fail = true;
    const resolveMock = vi.spyOn(resolveChannelModule, 'resolveChannel').mockImplementation(async () => {
      if (fail) throw new Error('fail');
      return sampleResolve();
    });

    const harness: HarnessState = { latest: null };
    const tree = TestRenderer.create(
      createElement(RheoProvider, {
        config: {
          publishableKey: 'ob_pk_test',
          apiBaseUrl: 'https://api.test',
          userId: 'u1',
        },
        children: createElement(Harness, {
          onUpdate: (r) => {
            harness.latest = r;
          },
        }),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.latest?.resolveFailed).toBe(true);

    fail = false;
    await act(async () => {
      harness.latest?.retry();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(harness.latest?.resolveFailed).toBe(false);
    expect(harness.latest?.manifest).not.toBeNull();
    tree.unmount();
  });
});
