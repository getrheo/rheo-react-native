import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SdkEventSchema } from '@getrheo/contracts';

const asyncStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => asyncStorageState.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      asyncStorageState.store.set(key, value);
    },
    removeItem: async (key: string) => {
      asyncStorageState.store.delete(key);
    },
  },
}));

import {
  buildSdkEvent,
  generateEventId,
  getResolvedAppUserId,
  hydrateResolvedAppUserIdFromStorage,
  PERSISTED_APP_USER_ID_KEY,
  __resetResolvedAppUserIdForTests,
} from './events';
import type {RheoConfig} from './client';

beforeEach(() => {
  __resetResolvedAppUserIdForTests();
  asyncStorageState.store.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetResolvedAppUserIdForTests();
});

const config: RheoConfig = {
  publishableKey: 'ob_pk_test_abc',
  apiBaseUrl: 'https://api.test',
  userId: 'user-1',
  customUserId: 'crm-99',
  sessionId: 'sess-1',
  locale: 'en',
  appVersion: '1.2.3',
  platform: 'ios',
  customProperties: { plan: 'pro' },
};

describe('getResolvedAppUserId', () => {
  it('returns config.userId when set', () => {
    expect(getResolvedAppUserId({ userId: 'host-1' })).toBe('host-1');
  });

  it('returns a stable v4-shaped id without userId in non-browser runtimes', () => {
    const a = getResolvedAppUserId({});
    const b = getResolvedAppUserId({});
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('persists via localStorage on web when userId is omitted', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    const first = getResolvedAppUserId({});
    const second = getResolvedAppUserId({});
    expect(first).toBe(second);
    expect(store.has(PERSISTED_APP_USER_ID_KEY)).toBe(true);
  });

  it('persists via AsyncStorage on native when userId is omitted', async () => {
    vi.stubGlobal('HermesInternal', {});
    const first = getResolvedAppUserId({});
    await hydrateResolvedAppUserIdFromStorage();
    const second = getResolvedAppUserId({});
    expect(first).toBe(second);
    expect(asyncStorageState.store.get(PERSISTED_APP_USER_ID_KEY)).toBe(first);
    __resetResolvedAppUserIdForTests();
    asyncStorageState.store.set(PERSISTED_APP_USER_ID_KEY, 'persisted-native-id');
    await hydrateResolvedAppUserIdFromStorage();
    expect(getResolvedAppUserId({})).toBe('persisted-native-id');
  });
});

describe('generateEventId', () => {
  it('returns an RFC 4122 v4-shaped string', () => {
    const id = generateEventId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns unique ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 50 }, generateEventId));
    expect(ids.size).toBe(50);
  });
});

describe('buildSdkEvent', () => {
  it('produces a payload that matches SdkEventSchema', () => {
    const event = buildSdkEvent(config, {
      name: 'flow_started',
      flowId: '11111111-1111-4111-8111-111111111111',
      versionId: '22222222-2222-4222-8222-222222222222',
    });
    const parsed = SdkEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('includes fieldClassification only when provided', () => {
    const safe = buildSdkEvent(config, {
      name: 'text_submitted',
      flowId: '11111111-1111-4111-8111-111111111111',
      versionId: '22222222-2222-4222-8222-222222222222',
      properties: { field_key: 'name', value: 'a' },
      fieldClassification: 'sensitive',
    });
    expect(safe.fieldClassification).toBe('sensitive');

    const without = buildSdkEvent(config, {
      name: 'flow_started',
      flowId: '11111111-1111-4111-8111-111111111111',
      versionId: '22222222-2222-4222-8222-222222222222',
    });
    expect(without.fieldClassification).toBeUndefined();
  });

  it('forwards identity + context from config', () => {
    const event = buildSdkEvent(config, {
      name: 'step_viewed',
      flowId: '11111111-1111-4111-8111-111111111111',
      versionId: '22222222-2222-4222-8222-222222222222',
      stepId: 'scr_intro',
    });
    expect(event.identity.appUserId).toBe('user-1');
    expect(event.identity.sessionId).toBe('sess-1');
    expect(event.identity.customUserId).toBe('crm-99');
    expect(event.context?.platform).toBe('ios');
    expect(event.context?.locale).toBe('en');
    expect(event.context?.appVersion).toBe('1.2.3');
    expect(event.context?.customProperties).toEqual({ plan: 'pro' });
  });

  it('uses resolved anonymous appUserId when userId is omitted', () => {
    const event = buildSdkEvent(
      { ...config, userId: undefined },
      {
        name: 'flow_started',
        flowId: '11111111-1111-4111-8111-111111111111',
        versionId: '22222222-2222-4222-8222-222222222222',
      },
    );
    expect(event.identity.appUserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('uses provided timestamp when supplied', () => {
    const event = buildSdkEvent(config, {
      name: 'flow_started',
      flowId: '11111111-1111-4111-8111-111111111111',
      versionId: '22222222-2222-4222-8222-222222222222',
      timestamp: '2026-04-01T00:00:00.000Z',
    });
    expect(event.timestamp).toBe('2026-04-01T00:00:00.000Z');
  });
});
