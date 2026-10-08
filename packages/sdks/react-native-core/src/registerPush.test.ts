import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RheoConfig } from './client';
import { __setPushTokenAdapterForTests } from './platform/pushTokenAdapter';
import {
  __resetPushRegistrationForTests,
  bindActivePushConfig,
  registerPush,
  rebindCachedPushRegistration,
  unregisterPush,
} from './registerPush';

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

const registered = {
  subscriptionId: '00000000-0000-4000-8000-000000000001',
  platform: 'ios',
  provider: 'apns',
};

const baseConfig = {
  publishableKey: 'pk_test',
  apiBaseUrl: 'https://api.test',
  userId: 'user-1',
};

const bodyOf = (fetcher: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> => {
  const init = fetcher.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
};

describe('registerPush', () => {
  afterEach(() => {
    __resetPushRegistrationForTests();
    __setPushTokenAdapterForTests(null);
    vi.restoreAllMocks();
  });

  it('posts a host token and rebinds it when userId changes', async () => {
    const fetcher = vi.fn(async () => jsonResponse(registered));
    const first = { ...baseConfig, fetcher: fetcher as typeof fetch };
    await registerPush({ token: 'device-token', platform: 'ios', provider: 'apns' }, first);
    expect(bodyOf(fetcher, 0)).toMatchObject({
      appUserId: 'user-1',
      platform: 'ios',
      provider: 'apns',
      token: 'device-token',
    });

    await rebindCachedPushRegistration({ ...first, userId: 'user-2' });
    expect(bodyOf(fetcher, 1).appUserId).toBe('user-2');
    expect(bodyOf(fetcher, 1).token).toBe('device-token');
  });

  it('reads the platform adapter when no token is passed', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ ...registered, platform: 'android', provider: 'fcm' }),
    );
    __setPushTokenAdapterForTests({
      getDevicePushToken: async () => ({
        token: 'fcm-token',
        platform: 'android',
        provider: 'fcm',
      }),
    });
    bindActivePushConfig({ ...baseConfig, fetcher: fetcher as typeof fetch } as RheoConfig);
    await registerPush();
    expect(bodyOf(fetcher, 0)).toMatchObject({ token: 'fcm-token', provider: 'fcm' });
  });

  it('unregisters the cached token', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      jsonResponse(String(input).includes('unregister') ? { ok: true } : registered),
    );
    const resolved = { ...baseConfig, fetcher: fetcher as typeof fetch };
    await registerPush({ token: 'device-token', platform: 'ios', provider: 'apns' }, resolved);
    await unregisterPush(resolved);
    const unregisterIndex = fetcher.mock.calls.findIndex((call) =>
      String(call[0]).includes('unregister'),
    );
    expect(bodyOf(fetcher, unregisterIndex)).toMatchObject({
      appUserId: 'user-1',
      token: 'device-token',
    });
  });
});
