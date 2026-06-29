import type { SdkEvent } from '@getrheo/contracts';
import type {RheoConfig} from './client';

/** Fields required to build SDK analytics events (`buildSdkEvent`). */
export type SdkEventBuildConfig = Pick<
  RheoConfig,
  'userId' | 'customUserId' | 'sessionId' | 'locale' | 'appVersion' | 'platform' | 'customProperties'
>;

/**
 * Generate an RFC 4122 v4 UUID. Hermes 0.83+ exposes
 * `globalThis.crypto.randomUUID()` natively; we keep a tiny polyfill so
 * the SDK still works on older runtimes (web, RN < 0.74) without forcing
 * a peer dep on `expo-crypto`.
 */
export const generateEventId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && 'getRandomValues' in c && typeof (c as { getRandomValues?: (b: Uint8Array) => Uint8Array }).getRandomValues === 'function') {
    (c as { getRandomValues: (b: Uint8Array) => Uint8Array }).getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

/** localStorage key for the default per-browser anonymous id. */
export const PERSISTED_APP_USER_ID_KEY = 'rheo_app_user_id';

let nonBrowserCachedAppUserId: string | null = null;

/**
 * When `config.userId` is set, returns it (host owns the primary id).
 * Otherwise returns a stable anonymous id: persisted in `localStorage` on
 * web, or an in-process singleton in non-browser runtimes (tests, SSR
 * without storage — React Native hosts should pass `userId` until a
 * storage adapter exists).
 */
export const getResolvedAppUserId = (config: Pick<RheoConfig, 'userId'>): string => {
  if (config.userId) return config.userId;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(PERSISTED_APP_USER_ID_KEY);
      if (existing) return existing;
      const id = generateEventId();
      window.localStorage.setItem(PERSISTED_APP_USER_ID_KEY, id);
      return id;
    } catch {
      /* private mode / quota — fall through */
    }
  }

  if (!nonBrowserCachedAppUserId) nonBrowserCachedAppUserId = generateEventId();
  return nonBrowserCachedAppUserId;
};

/** Test-only: clears the non-browser singleton. */
export const __resetResolvedAppUserIdForTests = (): void => {
  nonBrowserCachedAppUserId = null;
};

/**
 * Best-effort platform inference. We avoid a hard `react-native` import
 * so the SDK stays tree-shakeable on web. Hosts can override via
 * `config.platform` if the inference is wrong.
 */
const detectPlatform = (): 'ios' | 'android' | 'web' => {
  type RNGlobals = {
    HermesInternal?: unknown;
    nativePerformanceNow?: unknown;
    navigator?: { product?: string; userAgent?: string };
  };
  const g = globalThis as RNGlobals;
  if (g.HermesInternal || g.nativePerformanceNow) {
    // Best we can do without importing react-native: detect Hermes/RN
    // bridge presence and let the host override via config.platform.
    const ua = g.navigator?.userAgent ?? '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'ios';
  }
  return 'web';
};

/** Input shape used by the queue / hooks to enqueue an event. The SDK fills
 * in identity, context, eventId, and timestamp from the active config. */
export type TrackEventInput = {
  name: SdkEvent['name'];
  flowId: string;
  versionId: string;
  experimentId?: string | null;
  variantId?: string | null;
  stepId?: string | null;
  properties?: Record<string, string | number | boolean | null | string[]>;
  /** Required when name === 'text_submitted' so the API can redact. */
  fieldClassification?: 'safe' | 'sensitive';
  /** Override the auto-generated timestamp (mostly useful for tests). */
  timestamp?: string;
};

/**
 * Build a fully-formed `SdkEvent` from the SDK config + a user-supplied
 * input. Lives in this module so both the synchronous queue.enqueue path
 * and tests can construct identical payloads.
 */
export const buildSdkEvent = (
  config: SdkEventBuildConfig,
  input: TrackEventInput,
): SdkEvent => ({
  eventId: generateEventId(),
  name: input.name,
  timestamp: input.timestamp ?? new Date().toISOString(),
  flowId: input.flowId,
  versionId: input.versionId,
  experimentId: input.experimentId ?? null,
  variantId: input.variantId ?? null,
  stepId: input.stepId ?? null,
  identity: {
    appUserId: getResolvedAppUserId(config),
    ...(config.sessionId ? { sessionId: config.sessionId } : {}),
    ...(config.customUserId ? { customUserId: config.customUserId } : {}),
  },
  context: {
    platform: config.platform ?? detectPlatform(),
    ...(config.locale ? { locale: config.locale } : {}),
    ...(config.appVersion ? { appVersion: config.appVersion } : {}),
    ...(config.customProperties ? { customProperties: config.customProperties } : {}),
  },
  ...(input.properties ? { properties: input.properties } : {}),
  ...(input.fieldClassification ? { fieldClassification: input.fieldClassification } : {}),
});
