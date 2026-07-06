import { DEFAULT_SDK_LOG_LEVEL, RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import type { SdkLogLevel } from '@getrheo/contracts/sdk';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {ReactNode} from 'react';
import { EventQueue } from './eventQueue';
import type {SdkEventBuildConfig} from './events';
import {
  hydrateResolvedAppUserIdFromStorage,
  needsNativeAppUserIdHydration,
} from './events';
import { createSdkLogger, registerSdkLogLevel } from './logging/sdkLogger';
import type {AttributionRuntimeProvider, AttributionStorageAdapter, } from './attribution/attributionTypes';
import {
  __prefetchAllWithConfig,
  __prefetchChannelWithConfig,
  __registerPrefetchConfig,
} from './prefetch';

export type RheoAttributionConfig = {
  /** When false, skips attribution listeners and device cache (default: true). */
  enabled?: boolean;
  /** Persist last meaningful snapshot for TTL reuse when cold-open lacks MMP payload (default: true). */
  cache?: boolean;
  /** Defaults to 24h — see `@getrheo/attribution` `DEFAULT_ATTRIBUTION_CACHE_TTL_MS`. */
  cacheTtlMs?: number;
  /**
   * Explicit storage adapter (e.g. AsyncStorage). Pass `null` to disable persistence entirely.
   * When omitted, the SDK tries `@react-native-async-storage/async-storage` when bundled.
   */
  storage?: AttributionStorageAdapter | null;
  /**
 * Provider adapters that emit {@link import('@getrheo/attribution').NormalizedAttributionSnapshot}.
   * Defaults to built-in AppsFlyer when omitted (optional peer `react-native-appsflyer`).
   * Pass `[]` to disable all providers while keeping hooks dormant.
   */
  providers?: AttributionRuntimeProvider[];
};

export type RheoConfig = {
  /** App-scoped publishable key (ob_pk_test_* or ob_pk_live_*). */
  publishableKey: string;
  apiBaseUrl?: string;
  /** Primary end-user id for analytics and experiment bucketing. When
   * omitted, the SDK uses a persisted anonymous UUID (`localStorage` on
   * web; AsyncStorage on React Native). Forwarded as `identity.appUserId`. */
  userId?: string;
  /** Optional id from the host's backend (CRM / auth). Forwarded as
   * `identity.customUserId` alongside `appUserId` for dashboard joins. */
  customUserId?: string;
  /** Per-launch session id; forwarded as `identity.sessionId`. */
  sessionId?: string;
  locale?: string;
  /** Host app version, forwarded as `context.appVersion`. */
  appVersion?: string;
  /** Override platform inference. Useful when the host knows better
   * than `react-native`'s `Platform.OS` (e.g. running RN in a webview). */
  platform?: 'ios' | 'android' | 'web';
  /** Arbitrary KV forwarded into decision-node evaluation (`sdk` variable refs). */
  sdkAttributes?: Record<string, unknown>;
  /** Mobile attribution / deep-link context merged into sdkAttributes (reserved key prefixes). */
  attribution?: RheoAttributionConfig;
  customProperties?: Record<string, string>;
  /** Optional fetch override for testing or RN polyfills */
  fetcher?: typeof fetch;
};

type RheoCtxValue = {
  config: RheoConfig;
  queue: EventQueue;
  setCustomUserId: (next: string | undefined) => void;
};

const Ctx = createContext<RheoCtxValue | null>(null);

export const RheoProvider = ({
  config,
  prefetch,
  logLevel = DEFAULT_SDK_LOG_LEVEL,
  children,
}: {
  config: RheoConfig;
  /**
   * Warm the manifest cache on mount so flows render without a loading spinner.
   * `'all'` batch-prefetches every assigned channel for the app via
   * `POST /v1/sdk/resolve-all`; a list prefetches just those channel public ids.
   * Best-effort and silent — the mounted `Flow` still owns error/retry UI.
   */
  prefetch?: 'all' | string[];
  /**
   * SDK console diagnostics verbosity. Defaults to `silent` (no logs in production).
   * Use `warn` for transport/integration failures; `debug` enables dev-only
   * manifest dumps and misuse hints (requires a dev build).
   */
  logLevel?: SdkLogLevel;
  children: ReactNode;
}) => {
  const resolvedConfig = useMemo<RheoConfig>(
    () => ({
      apiBaseUrl: RHEO_DEFAULT_SDK_API_BASE_URL,
      ...config,
    }),
    [config],
  );
  if (!resolvedConfig.publishableKey) {
    throw new Error('RheoProvider: `publishableKey` is required');
  }

  const [customUserIdRuntime, setCustomUserIdRuntime] = useState<string | undefined>(() =>
    resolvedConfig.customUserId,
  );
  const [appUserIdReady, setAppUserIdReady] = useState(
    () => Boolean(resolvedConfig.userId) || !needsNativeAppUserIdHydration(),
  );
  useEffect(() => {
    setCustomUserIdRuntime(resolvedConfig.customUserId);
  }, [resolvedConfig.customUserId]);

  useEffect(() => {
    if (resolvedConfig.userId || !needsNativeAppUserIdHydration()) {
      setAppUserIdReady(true);
      return;
    }
    void hydrateResolvedAppUserIdFromStorage().finally(() => setAppUserIdReady(true));
  }, [resolvedConfig.userId]);

  const setCustomUserId = useCallback((next: string | undefined) => {
    setCustomUserIdRuntime(next);
  }, []);

  const mergedConfig = useMemo(
    (): RheoConfig => ({
      ...resolvedConfig,
      customUserId: customUserIdRuntime,
    }),
    [resolvedConfig, customUserIdRuntime],
  );

  useEffect(() => {
    registerSdkLogLevel(logLevel);
    return () => {
      registerSdkLogLevel(DEFAULT_SDK_LOG_LEVEL);
    };
  }, [logLevel]);

  // Register the active config so the standalone `prefetch` / `prefetchAll`
  // helpers work outside the React tree (navigation listeners, push handlers).
  const mergedConfigRef = useRef(mergedConfig);
  mergedConfigRef.current = mergedConfig;
  useEffect(() => {
    __registerPrefetchConfig(mergedConfig);
    return () => {
      __registerPrefetchConfig(null);
    };
  }, [mergedConfig]);

  // Tier 1: declared prefetch on mount. Keyed by the directive + identity that
  // affects the resolve cache key (publishable key, base URL, locale) so it does
  // not re-fire on unrelated config churn. Best-effort and silent.
  const prefetchKey = Array.isArray(prefetch) ? prefetch.join(',') : prefetch ?? '';
  useEffect(() => {
    if (!prefetch) return;
    const cfg = mergedConfigRef.current;
    if (prefetch === 'all') {
      void __prefetchAllWithConfig(cfg);
      return;
    }
    for (const channelId of prefetch) {
      void __prefetchChannelWithConfig(cfg, channelId);
    }
  }, [
    prefetchKey,
    resolvedConfig.publishableKey,
    resolvedConfig.apiBaseUrl,
    resolvedConfig.locale,
  ]);

  const sdkEventSnap = useRef<SdkEventBuildConfig>({
    userId: undefined,
    customUserId: undefined,
    sessionId: undefined,
    locale: undefined,
    appVersion: undefined,
    platform: undefined,
    customProperties: undefined,
  });
  sdkEventSnap.current = {
    userId: mergedConfig.userId,
    customUserId: mergedConfig.customUserId,
    sessionId: mergedConfig.sessionId,
    locale: mergedConfig.locale,
    appVersion: mergedConfig.appVersion,
    platform: mergedConfig.platform,
    customProperties: mergedConfig.customProperties,
  };

  const transport = useMemo(
    () => ({
      publishableKey: mergedConfig.publishableKey,
      apiBaseUrl: mergedConfig.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL,
      fetcher: mergedConfig.fetcher,
    }),
    [mergedConfig.publishableKey, mergedConfig.apiBaseUrl, mergedConfig.fetcher],
  );

  // Queue is stable across customUserId changes; identity for events is read at flush via sdkEventSnap.
  const queue = useMemo(
    () =>
      new EventQueue(transport, () => sdkEventSnap.current, createSdkLogger(logLevel)),
    [transport.publishableKey, transport.apiBaseUrl, transport.fetcher, logLevel],
  );

  // Best-effort flush when the provider unmounts (host shut down,
  // navigated away, etc.). We don't await — the function is fire-and-forget
  // matching the tech-spec's "5s batching, best-effort transport" promise.
  useEffect(() => {
    return () => {
      queue.shutdown();
    };
  }, [queue]);

  const value = useMemo<RheoCtxValue>(
    () => ({ config: mergedConfig, queue, setCustomUserId }),
    [mergedConfig, queue, setCustomUserId],
  );

  if (!appUserIdReady) return null;

  return createElement(Ctx.Provider, { value }, children);
};

export const useRheo = (): RheoConfig => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRheo must be used inside RheoProvider');
  return ctx.config;
};

export type RheoCustomUserIdControls = {
  customUserId: string | undefined;
  setCustomUserId: (next: string | undefined) => void;
};

/** Read/update CRM/backend id forwarded as `identity.customUserId` on SDK events (after flush). */
export const useRheoCustomUserId = (): RheoCustomUserIdControls => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRheoCustomUserId must be used inside RheoProvider');
  return {
    customUserId: ctx.config.customUserId,
    setCustomUserId: ctx.setCustomUserId,
  };
};

/** Internal-but-exported hook so the renderer + useFlow can push events
 * into the same queue the provider owns. */
export const useEventQueue = (): EventQueue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEventQueue must be used inside RheoProvider');
  return ctx.queue;
};

/**
 * Typed errors surfaced by the SDK so consumers can render targeted
 * fallbacks (e.g. "ask your team to unarchive this channel") instead
 * of a generic network failure.
 */
export class RheoChannelArchivedError extends Error {
  override readonly name = 'RheoChannelArchivedError';
}
export class RheoChannelNotFoundError extends Error {
  override readonly name = 'RheoChannelNotFoundError';
}
export class RheoChannelRequiredError extends Error {
  override readonly name = 'RheoChannelRequiredError';
}

/** Map an HTTP error response into a typed SDK error if applicable. */
export const mapChannelError = async (response: Response): Promise<Error> => {
  let payload: { code?: string; message?: string } = {};
  try {
    payload = (await response.clone().json()) as typeof payload;
  } catch {
    /* ignore non-JSON bodies */
  }
  const message = payload.message ?? `request failed: ${response.status}`;
  if (response.status === 410 && payload.code === 'channel_archived') {
    return new RheoChannelArchivedError(message);
  }
  if (response.status === 404 && payload.code === 'channel_not_found') {
    return new RheoChannelNotFoundError(message);
  }
  if (response.status === 400 && payload.code === 'channel_required') {
    return new RheoChannelRequiredError(message);
  }
  return new Error(message);
};
