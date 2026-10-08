import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetNativeProductAnalyticsAttributionForTests,
  settleNativeProductAnalyticsAttribution,
} from './productAnalyticsAttribution';
import {
  bindNavigationState,
  focusedRouteName,
  logEvent,
  screen,
  startNativeProductAnalytics,
} from './productAnalytics';

const STORAGE_KEYS = [
  'rheo_product_analytics_session_id',
  'rheo_product_analytics_session_last_at',
  'rheo_product_analytics_first_sent',
];

describe('native product analytics', () => {
  afterEach(async () => {
    vi.useRealTimers();
    resetNativeProductAnalyticsAttributionForTests();
    await Promise.all(STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)));
  });

  it('emits session_start and first_open, then logEvent and screen, without a flow', async () => {
    vi.useFakeTimers();
    settleNativeProductAnalyticsAttribution();
    const bodies: Array<{ events: Array<{ name: string; screenName?: string }> }> = [];
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as { events: Array<{ name: string; screenName?: string }> });
      return new Response(JSON.stringify({ accepted: true }), { status: 200 });
    });
    const stop = startNativeProductAnalytics({
      enabled: true,
      transport: {
        publishableKey: 'ob_pk_test_analytics',
        apiBaseUrl: 'https://api.test',
        fetcher: fetcher as unknown as typeof fetch,
      },
      getBuildConfig: () => ({ userId: 'user-1', platform: 'ios' }),
      onUserId: () => undefined,
    });
    await vi.waitFor(async () => {
      expect(await AsyncStorage.getItem('rheo_product_analytics_session_id')).toBeTruthy();
    });
    logEvent('workout_logged', { minutes: 10 });
    screen('Home');
    bindNavigationState({
      index: 0,
      routes: [{ name: 'Tabs', state: { index: 1, routes: [{ name: 'Settings' }, { name: 'Profile' }] } }],
    });
    await vi.advanceTimersByTimeAsync(5000);
    stop();
    const names = bodies.flatMap((body) => body.events.map((event) => event.name));
    expect(names).toEqual(
      expect.arrayContaining(['session_start', 'first_open', 'workout_logged', 'screen_view']),
    );
    const screens = bodies
      .flatMap((body) => body.events)
      .filter((event) => event.name === 'screen_view')
      .map((event) => event.screenName);
    expect(screens).toEqual(['Home', 'Profile']);
    expect(fetcher.mock.calls.every((call) => String(call[0]).endsWith('/v1/sdk/analytics/events'))).toBe(true);
  });
});

describe('focusedRouteName', () => {
  it('reads the focused nested route', () => {
    expect(
      focusedRouteName({
        index: 0,
        routes: [{ name: 'Root', state: { index: 0, routes: [{ name: 'Welcome' }] } }],
      }),
    ).toBe('Welcome');
  });
});
