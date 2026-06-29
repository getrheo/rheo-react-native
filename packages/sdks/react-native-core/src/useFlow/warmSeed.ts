import { initFlowState, startFlow, type FlowState } from '@getrheo/flow-runtime';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import type { SdkResolveResponse } from '@getrheo/contracts';
import type { useRheo } from '../client.js';
import { manifestResolveCacheKey, peekManifestResolveCache } from '../resolve/manifestResolveCache.js';
import { inferSdkPlatform } from './platform.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type WarmSeed = { resolved: SdkResolveResponse; state: FlowState };

/**
 * Synchronously read a prefetched manifest from the in-memory resolve cache and
 * build the initial running flow state. Returns `null` on a miss so `useFlow`
 * falls back to the on-demand resolve (with a spinner). Only reads memory — a
 * cold-start disk entry is not yet loaded, which is the intended trade-off.
 */
export const peekWarmSeed = (channelTrimmed: string, config: RheoConfig): WarmSeed | null => {
  if (channelTrimmed.length === 0) return null;
  const apiBaseUrl = config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL;
  const key = manifestResolveCacheKey(apiBaseUrl, config.publishableKey, channelTrimmed, config.locale);
  const cached = peekManifestResolveCache(key);
  if (!cached) return null;
  const resolved = cached.body;
  const state = startFlow(
    initFlowState(resolved.manifest, {
      locale: config.locale,
      platform: config.platform ?? inferSdkPlatform(),
      sdkAttributes: config.sdkAttributes ?? {},
    }),
  );
  return { resolved, state };
};
