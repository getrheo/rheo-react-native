import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SdkProductAnalyticsEvent } from '@getrheo/contracts';
import { ProductAnalyticsQueue } from './productAnalyticsQueue';

const event = (eventId: string): SdkProductAnalyticsEvent => ({
  eventId,
  name: 'page_view',
  timestamp: '2026-09-30T12:00:00.000Z',
  identity: { appUserId: 'user-1', sessionId: 'sess-1' },
});

const idsFrom = (init: RequestInit | undefined): string[] => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { events: Array<{ eventId: string }> };
  return body.events.map((item) => item.eventId);
};

describe('ProductAnalyticsQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const queueWith = (fetcher: typeof fetch) =>
    new ProductAnalyticsQueue({
      publishableKey: 'pk',
      apiBaseUrl: 'https://api.test',
      fetcher,
    });

  it('retries a 503 with the same event id', async () => {
    vi.useFakeTimers();
    let status = 503;
    const seen: string[][] = [];
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(idsFrom(init));
      return new Response('{}', { status });
    });
    const queue = queueWith(fetcher as unknown as typeof fetch);
    const id = '11111111-1111-4111-8111-111111111111';
    queue.enqueue(event(id));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(seen).toEqual([[id]]);
    status = 200;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(seen[1]).toEqual([id]);
    queue.dispose();
  });

  it('drops a 400 without retrying', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response('{}', { status: 400 }));
    const queue = queueWith(fetcher as unknown as typeof fetch);
    queue.enqueue(event('22222222-2222-4222-8222-222222222222'));
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    queue.dispose();
  });
});
