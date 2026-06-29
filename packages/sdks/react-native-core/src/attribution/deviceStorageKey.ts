/** Stable prefix — payload shape version lives in {@link ATTRIBUTION_CACHE_SCHEMA_VERSION}. */
export const ATTRIBUTION_STORAGE_PREFIX = 'rheo.attribution.cache';

export const buildAttributionStorageKey = (namespace: string): string => {
  const safe = namespace.trim().slice(0, 180) || 'anonymous';
  return `${ATTRIBUTION_STORAGE_PREFIX}.v1.${safe}`;
};
