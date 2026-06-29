import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ATTRIBUTION_CACHE_SCHEMA_VERSION,
  AttributionDeviceCacheEnvelopeSchema,
  DEFAULT_ATTRIBUTION_CACHE_TTL_MS,
  flattenAttributionSnapshotToSdkAttributes,
  mergeAttributionSnapshots,
  normalizedSnapshotHasSignal,
  type NormalizedAttributionSnapshot,
} from '@getrheo/attribution';
import type {AttributionRuntimeProvider, AttributionStorageAdapter, CreateAttributionRuntimeOptions, } from './attributionTypes';
import { buildAttributionStorageKey } from './deviceStorageKey';
import { createAppsFlyerAttributionProvider } from './providers/appsflyer';

export type AttributionRuntimeHandle = {
  subscribe(listener: (sdkAttrs: Record<string, unknown>) => void): () => void;
  dispose(): void;
};

export const createDefaultAttributionProviders = (): AttributionRuntimeProvider[] => [
  createAppsFlyerAttributionProvider(),
];

const resolveStorageAdapter = (
  explicit?: AttributionStorageAdapter | null,
): AttributionStorageAdapter | null => {
  if (explicit === null) return null;
  if (explicit !== undefined) return explicit;
  return AsyncStorage;
};

/**
 * Mobile attribution + deep-link context merged into flat sdk attribute keys (see `@getrheo/attribution`).
 * Live MMP callbacks override device cache; cache fills gaps within TTL when a cold open delivers no payload.
 */
export const createAttributionRuntime = (
  options: CreateAttributionRuntimeOptions,
): AttributionRuntimeHandle => {
  const {
    enabled = true,
    cacheEnabled = true,
    cacheTtlMs = DEFAULT_ATTRIBUTION_CACHE_TTL_MS,
    storageNamespace,
    storage: explicitStorage,
    providers: providersOpt,
  } = options;

  const providers =
    providersOpt === undefined ? createDefaultAttributionProviders() : providersOpt;

  let disposed = false;
  let liveMerged: NormalizedAttributionSnapshot | null = null;
  let cachedSnapshot: NormalizedAttributionSnapshot | null = null;
  let cacheLoaded = false;
  let cacheValid = false;

  const storageKey = buildAttributionStorageKey(storageNamespace);
  const listeners = new Set<(r: Record<string, unknown>) => void>();

  const getStorage = (): AttributionStorageAdapter | null =>
    resolveStorageAdapter(explicitStorage ?? null);

  const computeFlat = (): Record<string, unknown> => {
    if (!enabled) return {};
    if (liveMerged && normalizedSnapshotHasSignal(liveMerged)) {
      return flattenAttributionSnapshotToSdkAttributes(liveMerged);
    }
    if (
      cacheEnabled &&
      cacheLoaded &&
      cacheValid &&
      cachedSnapshot &&
      normalizedSnapshotHasSignal(cachedSnapshot)
    ) {
      return flattenAttributionSnapshotToSdkAttributes(cachedSnapshot);
    }
    return {};
  };

  const emit = (): void => {
    if (disposed) return;
    const flat = computeFlat();
    for (const l of listeners) l(flat);
  };

  const persistCache = async (snap: NormalizedAttributionSnapshot): Promise<void> => {
    if (!cacheEnabled || !normalizedSnapshotHasSignal(snap)) return;
    const st = await getStorage();
    if (!st) return;

    const envelope = {
      schemaVersion: ATTRIBUTION_CACHE_SCHEMA_VERSION,
      cachedAtMs: Date.now(),
      snapshot: {
        providerId: snap.providerId,
        capturedAtMs: snap.capturedAtMs,
        attribution: { ...snap.attribution },
        acquisition: { ...snap.acquisition },
        link: {
          entry: snap.link.entry,
          params: { ...(snap.link.params ?? {}) },
        },
      },
    };

    const parsed = AttributionDeviceCacheEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) return;
    await st.setItem(storageKey, JSON.stringify(parsed.data));
  };

  const hydrateCache = async (): Promise<void> => {
    if (!cacheEnabled) {
      cacheLoaded = true;
      cacheValid = false;
      emit();
      return;
    }

    const st = await getStorage();
    if (!st) {
      cacheLoaded = true;
      cacheValid = false;
      emit();
      return;
    }

    try {
      const raw = await st.getItem(storageKey);
      if (!raw) {
        cacheLoaded = true;
        cacheValid = false;
        emit();
        return;
      }
      const json = JSON.parse(raw) as unknown;
      const parsed = AttributionDeviceCacheEnvelopeSchema.safeParse(json);
      if (!parsed.success) {
        cacheLoaded = true;
        cacheValid = false;
        emit();
        return;
      }
      const age = Date.now() - parsed.data.cachedAtMs;
      cachedSnapshot = parsed.data.snapshot as NormalizedAttributionSnapshot;
      cacheValid = age >= 0 && age <= cacheTtlMs;
      cacheLoaded = true;
      emit();
    } catch {
      cacheLoaded = true;
      cacheValid = false;
      emit();
    }
  };

  void hydrateCache();

  const providerUnsubs = providers.map((p) =>
    p.subscribe((snap) => {
      if (!snap || !normalizedSnapshotHasSignal(snap)) return;
      liveMerged = liveMerged ? mergeAttributionSnapshots(liveMerged, snap) : snap;
      void persistCache(liveMerged);
      emit();
    }),
  );

  return {
    subscribe(listener: (sdkAttrs: Record<string, unknown>) => void): () => void {
      listeners.add(listener);
      listener(computeFlat());
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      disposed = true;
      listeners.clear();
      providerUnsubs.forEach((u) => u());
    },
  };
};
