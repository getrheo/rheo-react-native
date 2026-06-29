import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { RheoProvider } from '../client.js';
import { useFlow, type UseFlowResult } from './useFlow.js';
import * as resolveManifestModule from '../resolve/resolveManifest.js';
import {
  clearManifestResolveCacheMemoryForTests,
  manifestResolveCacheKey,
  saveManifestResolveCache,
} from '../resolve/manifestResolveCache.js';

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
    flowId: '00000000-0000-4000-8000-000000000001',
    versionId: '00000000-0000-4000-8000-000000000002',
    versionNumber: 1,
    assignmentVersion: 5,
    environment: 'test',
    channelId: 'ch_warm',
    experimentId: null,
    variantId: null,
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
          regions: { body: { id: 'lyr_stack', kind: 'stack', direction: 'vertical', children: [] } },
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
      appsflyer: { enabled: false },
    },
  }) satisfies SdkResolveResponse;

type HarnessState = { first: UseFlowResult | null };

const Harness = ({ onUpdate }: { onUpdate: (r: UseFlowResult) => void }) => {
  // Capture during render so the first committed render's state is observed.
  onUpdate(useFlow({ channelId: 'ch_warm' }));
  return null;
};

describe('useFlow warm mount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearManifestResolveCacheMemoryForTests();
  });

  it('renders synchronously without loading when the cache is warm', async () => {
    await saveManifestResolveCache(
      manifestResolveCacheKey('https://api.test', 'ob_pk_test', 'ch_warm'),
      { etag: '"5-uuid"', body: sampleResolve(), cachedAt: 0 },
    );
    // Background revalidation should never re-resolve over the network in the test.
    const resolveSpy = vi
      .spyOn(resolveManifestModule, 'resolveManifest')
      .mockResolvedValue(sampleResolve());

    const harness: HarnessState = { first: null };
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(RheoProvider, {
          config: { publishableKey: 'ob_pk_test', apiBaseUrl: 'https://api.test', userId: 'u1' },
          children: createElement(Harness, {
            onUpdate: (r) => {
              if (harness.first === null) harness.first = r;
            },
          }),
        }),
      );
    });

    // First committed render is already warm: no spinner, manifest present.
    expect(harness.first?.loading).toBe(false);
    expect(harness.first?.manifest).not.toBeNull();

    // Background revalidation is cache-only and must not hot-swap a full re-resolve setState.
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});
