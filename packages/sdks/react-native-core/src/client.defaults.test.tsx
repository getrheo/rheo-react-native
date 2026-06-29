import { createElement, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import { RheoProvider, useRheo } from './client.js';

type ReactTestRenderer = { unmount: () => void };
type RtrModule = {
  create: (el: unknown) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;

vi.mock('./eventQueue.js', () => ({
  EventQueue: vi.fn().mockImplementation(() => ({
    enqueue: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('RheoProvider defaults', () => {
  it('uses RHEO_DEFAULT_SDK_API_BASE_URL when apiBaseUrl is omitted', async () => {
    let apiBaseUrl: string | undefined;
    const Probe = () => {
      const config = useRheo();
      useEffect(() => {
        apiBaseUrl = config.apiBaseUrl;
      }, [config.apiBaseUrl]);
      return null;
    };

    const tree = TestRenderer.create(
      createElement(RheoProvider, {
        config: { publishableKey: 'ob_pk_test_xxx' },
        children: createElement(Probe),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiBaseUrl).toBe(RHEO_DEFAULT_SDK_API_BASE_URL);
    await act(async () => {
      tree.unmount();
    });
  });
});
