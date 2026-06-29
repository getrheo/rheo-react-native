import type {NormalizedAttributionSnapshot} from '@getrheo/attribution';

/**
 * Optional persistence interface (e.g. `@react-native-async-storage/async-storage`).
 */
export type AttributionStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type AttributionRuntimeProvider = {
  readonly id: NormalizedAttributionSnapshot['providerId'];
  /**
   * Subscribe to normalized snapshots. Implementations may invoke the listener
   * multiple times as install conversion / deep-link callbacks arrive.
   */
  subscribe(listener: (snapshot: NormalizedAttributionSnapshot | null) => void): () => void;
};

export type CreateAttributionRuntimeOptions = {
  /** When false, emits `{}` and skips listeners (default: true). */
  enabled?: boolean;
  /** Persist last meaningful snapshot for TTL reuse when cold-open lacks MMP payload (default: true). */
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  /** Scoped cache key fragment — typically a stable app user id. */
  storageNamespace: string;
  storage?: AttributionStorageAdapter | null;
  /** When omitted, defaults to built-in AppsFlyer adapter registration. Pass `[]` to disable all. */
  providers?: AttributionRuntimeProvider[];
};
