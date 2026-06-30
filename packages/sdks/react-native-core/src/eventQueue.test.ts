import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SDK_EVENT_FLUSH_MS, SdkEventBatchSchema } from '@getrheo/contracts';
import { type SdkEventBuildConfig, type TrackEventInput } from './events';
import { EventQueue } from './eventQueue';
import { createSdkLogger } from './logging/sdkLogger';

const baseSnap: SdkEventBuildConfig = {
  userId: 'user-1',
  sessionId: 'sess-1',
  appVersion: '1.0.0',
  locale: undefined,
  platform: undefined,
  customProperties: undefined,
  customUserId: undefined,
};

const makeQueue = (
  fetcher: typeof fetch,
  getSnap?: () => SdkEventBuildConfig,
  logger?: ConstructorParameters<typeof EventQueue>[2],
) =>
  new EventQueue(
    { publishableKey: 'ob_pk_test_abc', apiBaseUrl: 'https://api.test', fetcher },
    getSnap ?? (() => baseSnap),
    logger,
  );

const startEvent: TrackEventInput = {
  name: 'flow_started',
  flowId: '11111111-1111-4111-8111-111111111111',
  versionId: '22222222-2222-4222-8222-222222222222',
};

const completeEvent: TrackEventInput = {
  name: 'flow_completed',
  flowId: '11111111-1111-4111-8111-111111111111',
  versionId: '22222222-2222-4222-8222-222222222222',
};

const CH_A = 'ch_test_a';
const CH_B = 'ch_test_b';

const okResponse = (): Response =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EventQueue', () => {
  it('flushes after SDK_EVENT_FLUSH_MS', async () => {
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue(startEvent, { channelId: CH_A });
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SDK_EVENT_FLUSH_MS - 1);
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('force-flushes on flow_completed', async () => {
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue(completeEvent, { channelId: CH_A });
    await vi.runOnlyPendingTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('force-flushes on flow_abandoned', async () => {
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue({ ...startEvent, name: 'flow_abandoned' }, { channelId: CH_A });
    await vi.runOnlyPendingTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('flushes early when the buffer reaches MAX_BATCH_SIZE', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    for (let i = 0; i < 500; i += 1) q.enqueue(startEvent, { channelId: CH_A });
    await vi.runOnlyPendingTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    const init = call?.[1] as RequestInit | undefined;
    const body = init?.body
      ? (JSON.parse(init.body as string) as { events: unknown[] })
      : { events: [] };
    expect(body.events).toHaveLength(500);
    const hdr = init?.headers as Record<string, string>;
    expect(hdr['x-rheo-channel']).toBe(CH_A);
  });

  it('posts once per channel when mixing events in one buffer', async () => {
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue(startEvent, { channelId: CH_A });
    q.enqueue(startEvent, { channelId: CH_B });
    await vi.runOnlyPendingTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstCall = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall?.[0]).toContain('/v1/sdk/events');
    const channelHeaders = fetcher.mock.calls.map((call) => {
      const row = call as unknown as [string, RequestInit];
      const init = row[1];
      const hdr = init?.headers as Record<string, string>;
      return hdr['x-rheo-channel'] ?? '';
    });
    expect(new Set(channelHeaders)).toEqual(new Set([CH_A, CH_B]));
  });

  it('uses latest customUserId from snapshot when flushing', async () => {
    let customUserId: string | undefined = 'crm-a';
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch, () => ({
      ...baseSnap,
      customUserId,
    }));
    q.enqueue(startEvent, { channelId: CH_A });
    await q.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const fc = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const firstBody = JSON.parse(fc[1]?.body as string) as {
      events: { identity: { customUserId?: string } }[];
    };
    expect(firstBody.events[0]?.identity.customUserId).toBe('crm-a');

    customUserId = 'crm-b';
    q.enqueue(completeEvent, { channelId: CH_A });
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();

    expect(fetcher).toHaveBeenCalledTimes(2);
    const sc = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    const secondBody = JSON.parse(sc[1]?.body as string) as {
      events: { identity: { customUserId?: string } }[];
    };
    expect(secondBody.events[0]?.identity.customUserId).toBe('crm-b');
  });

  it('shutdown drains the buffer best-effort', async () => {
    const fetcher = vi.fn(async () => okResponse());
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue(startEvent, { channelId: CH_A });
    q.shutdown();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('default silent logger does not warn on fetch errors', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const q = makeQueue(fetcher as unknown as typeof fetch, undefined, createSdkLogger('silent'));
    q.enqueue(completeEvent, { channelId: CH_A });
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('warns on missing channelId when logger level is warn', () => {
    const warn = vi.fn();
    const q = makeQueue(vi.fn() as unknown as typeof fetch, undefined, { warn, debug: vi.fn() });
    q.enqueue(startEvent, { channelId: '  ' });
    expect(warn).toHaveBeenCalledWith(
      '[rheo] enqueue skipped: missing channelId',
      expect.objectContaining({ name: 'flow_started' }),
    );
  });

  it('swallows fetch errors and warns', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });
    const warn = vi.fn();
    const q = makeQueue(fetcher as unknown as typeof fetch, undefined, {
      warn,
      debug: vi.fn(),
    });
    q.enqueue(completeEvent, { channelId: CH_A });
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('produces payloads that satisfy SdkEventBatchSchema', async () => {
    let captured: unknown = null;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.body) captured = JSON.parse(init.body as string);
      return okResponse();
    });
    const q = makeQueue(fetcher as unknown as typeof fetch);
    q.enqueue(
      {
        name: 'text_submitted',
        flowId: '11111111-1111-4111-8111-111111111111',
        versionId: '22222222-2222-4222-8222-222222222222',
        stepId: 'scr_intro',
        properties: { field_key: 'name', value: 'Stefano' },
        fieldClassification: 'safe',
      },
      { channelId: CH_A },
    );
    q.enqueue(completeEvent, { channelId: CH_A });
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(captured).not.toBeNull();
    const parsed = SdkEventBatchSchema.safeParse(captured);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.events).toHaveLength(2);
      const first = parsed.data.events[0];
      expect(first?.identity.appUserId).toBe('user-1');
      expect(first?.identity.sessionId).toBe('sess-1');
      expect(first?.context?.appVersion).toBe('1.0.0');
    }
  });
});
