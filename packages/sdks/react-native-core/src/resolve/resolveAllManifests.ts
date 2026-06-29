import type { SdkResolveAllResponse, SdkResolveResponse } from '@getrheo/contracts';
import { mapChannelError } from '../client.js';
import { getResolvedAppUserId } from '../events.js';
import type { useRheo } from '../client.js';
import {
  manifestResolveCacheKey,
  saveManifestResolveCache,
} from './manifestResolveCache.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type ResolveAllManifestsParams = {
  apiBaseUrl: string;
  publishableKey: string;
  config: RheoConfig;
  fetcher?: typeof fetch;
};

/** Server builds the per-channel ETag as `"${assignmentVersion}-${versionId}"`. */
const reconstructEtag = (entry: SdkResolveResponse): string =>
  `"${entry.assignmentVersion}-${entry.versionId}"`;

/**
 * Batch-prefetch every assigned channel for the app (`POST /v1/sdk/resolve-all`)
 * and write each entry through to the manifest cache (memory + AsyncStorage) so a
 * later `Flow` mount renders without a network round-trip. Returns the resolved
 * entries; throws on transport/auth failure (callers treat prefetch as best-effort).
 */
export const resolveAllManifests = async ({
  apiBaseUrl,
  publishableKey,
  config,
  fetcher = config.fetcher ?? fetch,
}: ResolveAllManifestsParams): Promise<SdkResolveResponse[]> => {
  const response = await fetcher(`${apiBaseUrl}/v1/sdk/resolve-all`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${publishableKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      identity: { appUserId: getResolvedAppUserId(config) },
      context: config.locale ? { locale: config.locale } : undefined,
    }),
  });

  if (!response.ok) {
    throw await mapChannelError(response);
  }

  const data = (await response.json()) as SdkResolveAllResponse;
  const channels = data.channels ?? [];
  const cachedAt = Date.now();

  await Promise.all(
    channels.map((entry) =>
      saveManifestResolveCache(
        manifestResolveCacheKey(apiBaseUrl, publishableKey, entry.channelId, config.locale),
        { etag: reconstructEtag(entry), body: entry, cachedAt },
      ),
    ),
  );

  return channels;
};
