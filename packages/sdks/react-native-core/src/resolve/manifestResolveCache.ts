import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SdkResolveResponse } from '@getrheo/contracts';

export type ManifestResolveCacheEntry = {
  etag: string;
  body: SdkResolveResponse;
  cachedAt: number;
};

type StoredManifestResolveCacheEntry = {
  etag: string;
  body: SdkResolveResponse;
  cachedAt: number;
};

const memory = new Map<string, ManifestResolveCacheEntry>();

export const MANIFEST_RESOLVE_CACHE_KEY_PREFIX = 'rheo:resolve:';

export type ManifestResolveCacheKeyParts = {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  locale: string;
};

export type ManifestResolveCacheSummary = ManifestResolveCacheKeyParts & {
  key: string;
  etag: string;
  flowId: string;
  versionId: string;
  cachedAt: number;
  inMemory: boolean;
};

const normalizeApiBaseUrl = (url: string): string => url.replace(/\/+$/, '');

/** Parses a persisted manifest cache key back into its segments. */
export const parseManifestResolveCacheKey = (
  key: string,
): ManifestResolveCacheKeyParts | null => {
  if (!key.startsWith(MANIFEST_RESOLVE_CACHE_KEY_PREFIX)) return null;
  const rest = key.slice(MANIFEST_RESOLVE_CACHE_KEY_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length < 4) return null;
  const locale = parts[parts.length - 1] ?? '';
  const channelId = parts[parts.length - 2] ?? '';
  const publishableKey = parts[parts.length - 3] ?? '';
  const apiBaseUrl = parts.slice(0, -3).join(':');
  if (!apiBaseUrl || !publishableKey || !channelId) return null;
  return { apiBaseUrl, publishableKey, channelId, locale };
};

const summarizeEntry = (
  key: string,
  entry: ManifestResolveCacheEntry,
  inMemory: boolean,
): ManifestResolveCacheSummary | null => {
  const parsed = parseManifestResolveCacheKey(key);
  if (!parsed) return null;
  return {
    ...parsed,
    key,
    etag: entry.etag,
    flowId: entry.body.flowId,
    versionId: entry.body.versionId,
    cachedAt: entry.cachedAt,
    inMemory,
  };
};

/** Lists every manifest cache entry in memory and on disk (AsyncStorage). */
export const listManifestResolveCacheEntries = async (): Promise<
  ManifestResolveCacheSummary[]
> => {
  const keys = new Set<string>(memory.keys());
  try {
    const storedKeys = await AsyncStorage.getAllKeys();
    for (const key of storedKeys) {
      if (key.startsWith(MANIFEST_RESOLVE_CACHE_KEY_PREFIX)) keys.add(key);
    }
  } catch {
    // Best-effort listing for debug / example tooling.
  }

  const summaries: ManifestResolveCacheSummary[] = [];
  for (const key of keys) {
    const inMemory = memory.has(key);
    const entry = inMemory
      ? memory.get(key)!
      : await loadManifestResolveCache(key);
    if (!entry) continue;
    const summary = summarizeEntry(key, entry, inMemory);
    if (summary) summaries.push(summary);
  }

  return summaries.sort((a, b) => b.cachedAt - a.cachedAt);
};

/** Clears every manifest cache entry from memory and AsyncStorage. Returns count removed. */
export const clearManifestResolveCache = async (): Promise<number> => {
  const keys = new Set<string>(memory.keys());
  try {
    const storedKeys = await AsyncStorage.getAllKeys();
    for (const key of storedKeys) {
      if (key.startsWith(MANIFEST_RESOLVE_CACHE_KEY_PREFIX)) keys.add(key);
    }
  } catch {
    /* ignore */
  }
  memory.clear();
  const keyList = [...keys];
  if (keyList.length > 0) {
    try {
      await AsyncStorage.multiRemove(keyList);
    } catch {
      /* ignore */
    }
  }
  return keyList.length;
};

export const manifestResolveCacheKey = (
  apiBaseUrl: string,
  publishableKey: string,
  channelId: string,
  locale?: string,
): string =>
  `rheo:resolve:${normalizeApiBaseUrl(apiBaseUrl)}:${publishableKey}:${channelId.trim()}:${locale?.trim() ?? ''}`;

export const shouldSendManifestConditional = (
  entry: ManifestResolveCacheEntry | null | undefined,
): entry is ManifestResolveCacheEntry =>
  Boolean(entry?.etag?.trim() && entry.body);

export const peekManifestResolveCache = (
  key: string,
): ManifestResolveCacheEntry | null => memory.get(key) ?? null;

const parseStoredEntry = (raw: string): ManifestResolveCacheEntry | null => {
  try {
    const parsed = JSON.parse(raw) as StoredManifestResolveCacheEntry;
    if (
      typeof parsed?.etag !== 'string' ||
      !parsed.etag.trim() ||
      !parsed.body ||
      typeof parsed.body.flowId !== 'string'
    ) {
      return null;
    }
    return {
      etag: parsed.etag.trim(),
      body: parsed.body,
      cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : Date.now(),
    };
  } catch {
    return null;
  }
};

export const loadManifestResolveCache = async (
  key: string,
): Promise<ManifestResolveCacheEntry | null> => {
  const mem = memory.get(key);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = parseStoredEntry(raw);
    if (!entry) return null;
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
};

export const saveManifestResolveCache = async (
  key: string,
  entry: ManifestResolveCacheEntry,
): Promise<void> => {
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        etag: entry.etag,
        body: entry.body,
        cachedAt: entry.cachedAt,
      } satisfies StoredManifestResolveCacheEntry),
    );
  } catch {
    // Persistence is best-effort; in-memory cache still applies for the session.
  }
};

/** Test-only: reset in-memory cache between Vitest cases. */
export const clearManifestResolveCacheMemoryForTests = (): void => {
  memory.clear();
};
