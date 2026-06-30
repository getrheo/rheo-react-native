import { SDK_EVENT_FLUSH_MS, type SdkEvent } from '@getrheo/contracts';
import { buildSdkEvent, type SdkEventBuildConfig, type TrackEventInput } from './events';
import { createSdkLogger, type SdkLogger } from './logging/sdkLogger';

/** Server-side cap (matches `SdkEventBatchSchema.events.max(500)`). When a
 * single batch would exceed this, the queue flushes early and starts a
 * new buffer. */
const MAX_BATCH_SIZE = 500;

/** Event names that should trigger an immediate flush. Completion +
 * abandonment events are terminal — losing them to a 5-second window
 * would skew funnel analytics, so we drain the buffer right away. */
const TERMINAL_EVENTS: ReadonlySet<SdkEvent['name']> = new Set([
  'flow_completed',
  'flow_abandoned',
]);

type Logger = SdkLogger;

export type EventQueueTransport = {
  publishableKey: string;
  apiBaseUrl: string;
  fetcher?: typeof fetch;
};

type BufferedItem = {
  channelId: string;
  input: TrackEventInput;
};

/**
 * In-memory event queue with time-based batching, matching the tech-spec
 * (`SDK_EVENT_FLUSH_MS = 5000`). Events are POSTed to `/v1/sdk/events`
 * either:
 *  - on a 5-second timer (most events), or
 *  - immediately when the buffer hits {@link MAX_BATCH_SIZE}, or
 *  - immediately when a terminal event (`flow_completed` / `flow_abandoned`)
 *    is enqueued, or
 *  - synchronously-fired (best effort, not awaited) when the provider
 *    unmounts.
 *
 * The API requires one `X-Rheo-Channel` per request; buffers are
 * partitioned by channel at flush so mixed-channel batches become
 * multiple POSTs.
 *
 * Failed POSTs drop the batch and log via the configured logger
 * (default silent). The queue is intentionally non-persistent —
 * the plan deferred AsyncStorage-backed persistence to a follow-up.
 */
export class EventQueue {
  private buffer: BufferedItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private disposed = false;

  constructor(
    private readonly transport: EventQueueTransport,
    private readonly getSdkEventBuildConfig: () => SdkEventBuildConfig,
    private readonly logger: Logger = createSdkLogger('silent'),
  ) {}

  /** Enqueue an event. Schedules the next flush if one isn't pending. */
  enqueue = (input: TrackEventInput, meta: { channelId: string }): void => {
    if (this.disposed) return;
    const ch = meta.channelId?.trim();
    if (!ch) {
      this.logger.warn('[rheo] enqueue skipped: missing channelId', { name: input.name });
      return;
    }
    this.buffer.push({ channelId: ch, input });

    if (this.buffer.length >= MAX_BATCH_SIZE || TERMINAL_EVENTS.has(input.name)) {
      this.scheduleFlushNow();
      return;
    }
    this.scheduleFlushSoon();
  };

  /** Drain the buffer right now (still asynchronous). Resolves once the
   * in-flight flush work completes, or immediately if there's nothing to send. */
  flush = async (): Promise<void> => {
    this.clearTimer();
    if (this.buffer.length === 0) {
      if (this.inflight) await this.inflight;
      return;
    }

    const work = async () => {
      const drained = this.buffer.splice(0, this.buffer.length);
      const byChannel = new Map<string, TrackEventInput[]>();
      for (const row of drained) {
        const list = byChannel.get(row.channelId);
        if (list) list.push(row.input);
        else byChannel.set(row.channelId, [row.input]);
      }

       
      for (const [channelId, inputs] of byChannel) {
        for (let i = 0; i < inputs.length; i += MAX_BATCH_SIZE) {
          const slice = inputs.slice(i, i + MAX_BATCH_SIZE);
          const events = slice.map((inp) => buildSdkEvent(this.getSdkEventBuildConfig(), inp));
           
          await this.send(events, channelId);
        }
      }
    };

    const p = (async () => {
      await work();
      if (this.buffer.length > 0) await this.flush();
    })();

    this.inflight = p;
    try {
      await p;
    } finally {
      if (this.inflight === p) this.inflight = null;
    }
  };

  /** Fire-and-forget shutdown used by provider unmount. Never throws. */
  shutdown = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    if (this.buffer.length === 0) return;

    const drained = this.buffer.splice(0, this.buffer.length);
    const byChannel = new Map<string, TrackEventInput[]>();
    for (const row of drained) {
      const list = byChannel.get(row.channelId);
      if (list) list.push(row.input);
      else byChannel.set(row.channelId, [row.input]);
    }

    const drainChannel = async (channelId: string, inputs: TrackEventInput[]) => {
      for (let i = 0; i < inputs.length; i += MAX_BATCH_SIZE) {
        const slice = inputs.slice(i, i + MAX_BATCH_SIZE);
        const events = slice.map((inp) => buildSdkEvent(this.getSdkEventBuildConfig(), inp));
         
        await this.send(events, channelId);
      }
    };

    void (async () => {
       
      for (const [channelId, inputs] of byChannel) {
         
        await drainChannel(channelId, inputs);
      }
    })().catch(() => {});
  };

  /** Drop everything currently buffered without sending. Test-only. */
  __resetForTests = (): void => {
    this.clearTimer();
    this.buffer.length = 0;
    this.inflight = null;
    this.disposed = false;
  };

  private scheduleFlushSoon = (): void => {
    if (this.timer || this.disposed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SDK_EVENT_FLUSH_MS);
  };

  private scheduleFlushNow = (): void => {
    this.clearTimer();
    void this.flush();
  };

  private clearTimer = (): void => {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  private send = async (events: SdkEvent[], channelId: string): Promise<void> => {
    if (events.length === 0) return;
    const fetcher = this.transport.fetcher ?? fetch;
    try {
      const res = await fetcher(`${this.transport.apiBaseUrl}/v1/sdk/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.transport.publishableKey}`,
          'x-rheo-channel': channelId,
        },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) {
        this.logger.warn(
          `[rheo] events POST failed: ${res.status}`,
          { count: events.length },
        );
      }
    } catch (err) {
      this.logger.warn('[rheo] events POST error', {
        count: events.length,
        error: (err as Error).message,
      });
    }
  };
}
